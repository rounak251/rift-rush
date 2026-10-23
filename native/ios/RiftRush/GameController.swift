import UIKit
import WebKit
import GoogleMobileAds
import UserMessagingPlatform

final class GameController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, FullScreenContentDelegate {
    private var web: WKWebView!
    private let origin = "https://rift-rush-rounak.lunarbook256.chatgpt.site"
    private var resources: URL!
    private var interstitial: InterstitialAd?
    private var rewarded: RewardedAd?
    private var adsStarted = false
    private var adRequest: String?
    private var earned = false
    private var lastAd = Date()
    #if DEBUG
    private let adsEnabled = true
    private let interstitialID = "ca-app-pub-3940256099942544/4411468910"
    private let rewardedID = "ca-app-pub-3940256099942544/1712485313"
    #else
    // Enable only after owner-supplied production IDs and publisher approval.
    private let adsEnabled = false
    private let interstitialID = ""
    private let rewardedID = ""
    #endif

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 16/255, green: 19/255, blue: 18/255, alpha: 1)
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "rift")
        config.allowsInlineMediaPlayback = true
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.isOpaque = false
        web.backgroundColor = view.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        resources = Bundle.main.resourceURL!.appendingPathComponent("www", isDirectory: true)
        web.loadFileURL(resources.appendingPathComponent("index.html"), allowingReadAccessTo: resources)
        if adsEnabled {
            ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters()) { [weak self] error in
                guard let self else { return }
                Task { @MainActor in
                    if error == nil { try? await ConsentForm.loadAndPresentIfRequired(from: self) }
                    self.startAdsIfAllowed()
                }
            }
        }
    }
    func pauseGame() { web?.evaluateJavaScript("window.dispatchEvent(new Event('blur'))", completionHandler: nil) }
    private func startAdsIfAllowed() {
        guard adsEnabled, !adsStarted, ConsentInformation.shared.canRequestAds else { return }
        adsStarted = true
        MobileAds.shared.start { [weak self] _ in Task { @MainActor in await self?.loadAds() } }
    }
    @MainActor private func loadAds() async {
        guard adsStarted, ConsentInformation.shared.canRequestAds else { return }
        interstitial = try? await InterstitialAd.load(with: interstitialID, request: Request())
        interstitial?.fullScreenContentDelegate = self
        rewarded = try? await RewardedAd.load(with: rewardedID, request: Request())
        rewarded?.fullScreenContentDelegate = self
    }
    private func reply(_ id: String, _ data: [String: Any]) {
        var result = data; result["id"] = id
        guard let bytes = try? JSONSerialization.data(withJSONObject: result), let json = String(data: bytes, encoding: .utf8) else { return }
        DispatchQueue.main.async { self.web.evaluateJavaScript("window.riftNativeReply(\(json))", completionHandler: nil) }
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url, url.isFileURL,
              url.standardizedFileURL.path.hasPrefix(resources.standardizedFileURL.path + "/"),
              let data = message.body as? [String: Any], let id = data["id"] as? String,
              id.count < 80, let action = data["action"] as? String else { return }
        switch action {
        case "capabilities":
            #if DEBUG
            let test = true
            #else
            let test = false
            #endif
            reply(id, ["status":"ready","ads":adsStarted,"testAds":test,"rewardReady":rewarded != nil,"privacyRequired":ConsentInformation.shared.privacyOptionsRequirementStatus == .required])
        case "share":
            guard let text = data["text"] as? String, text.count < 2000 else { return }
            let share = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            share.popoverPresentationController?.sourceView = view
            share.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            present(share, animated: true); reply(id,["status":"finished"])
        case "api": proxyAPI(id,data)
        case "privacy":
            Task { @MainActor in try? await ConsentForm.presentPrivacyOptionsForm(from: self); self.reply(id,["status":"finished"]) }
        case "interstitial":
            guard adRequest == nil, let ad = interstitial, Date().timeIntervalSince(lastAd) >= 180, ConsentInformation.shared.canRequestAds else { reply(id,["status":"unavailable"]); return }
            adRequest=id;earned=false;interstitial=nil;pauseForAd();ad.present(from: self)
        case "rewarded":
            guard adRequest == nil, let ad = rewarded, ConsentInformation.shared.canRequestAds else { reply(id,["status":"unavailable"]); return }
            adRequest=id;earned=false;rewarded=nil;pauseForAd();ad.present(from: self) { [weak self] in self?.earned=true }
        default: reply(id,["status":"unavailable"])
        }
    }
    private func proxyAPI(_ id:String,_ data:[String:Any]) {
        guard let path=data["path"] as? String, ["/api/runs/start","/api/runs/finish","/api/leaderboard?mode=daily"].contains(path), let url=URL(string:origin+path) else { reply(id,["httpStatus":400]); return }
        var req=URLRequest(url:url);req.timeoutInterval=6
        if let body=data["body"], !(body is NSNull) {
            guard let bytes=try? JSONSerialization.data(withJSONObject:body), bytes.count<=49152 else { reply(id,["httpStatus":413]); return }
            req.httpMethod="POST";req.httpBody=bytes;req.setValue("application/json",forHTTPHeaderField:"Content-Type");req.setValue(origin,forHTTPHeaderField:"Origin")
        }
        URLSession.shared.dataTask(with:req) { [weak self] bytes,response,error in
            let status=(response as? HTTPURLResponse)?.statusCode ?? 503
            let payload=bytes.flatMap { try? JSONSerialization.jsonObject(with:$0) } ?? ["error":"Scores unavailable"]
            self?.reply(id,["httpStatus":status,"data":payload])
        }.resume()
    }
    private func pauseForAd() { web.evaluateJavaScript("window.dispatchEvent(new Event('rift-ad-start'))",completionHandler:nil) }
    private func finishAd() {
        guard let id=adRequest else{return};adRequest=nil;lastAd=Date()
        web.evaluateJavaScript("window.dispatchEvent(new Event('rift-ad-end'))",completionHandler:nil)
        reply(id,["status":"finished","earned":earned]);earned=false
        Task { @MainActor in await loadAds() }
    }
    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) { finishAd() }
    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) { finishAd() }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy)->Void) {
        guard let url=action.request.url else {decisionHandler(.cancel);return}
        if url.isFileURL && url.standardizedFileURL.path.hasPrefix(resources.standardizedFileURL.path+"/") {decisionHandler(.allow);return}
        if action.targetFrame?.isMainFrame != false && url.scheme=="https" {UIApplication.shared.open(url)}
        decisionHandler(.cancel)
    }
    deinit { web?.configuration.userContentController.removeScriptMessageHandler(forName:"rift") }
}
