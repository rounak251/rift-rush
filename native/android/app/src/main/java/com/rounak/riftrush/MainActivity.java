package com.rounak.riftrush;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.os.Bundle;
import android.net.Uri;
import android.content.Intent;
import android.webkit.*;
import android.view.View;
import androidx.annotation.NonNull;
import androidx.webkit.*;
import com.google.android.gms.ads.*;
import com.google.android.gms.ads.interstitial.*;
import com.google.android.gms.ads.rewarded.*;
import com.google.android.ump.*;
import org.json.JSONObject;
import java.util.Collections;

public class MainActivity extends ComponentActivity {
 private static final String HOST="rift-rush-rounak.lunarbook256.chatgpt.site", ORIGIN="https://"+HOST;
 private WebView web; private ConsentInformation consent; private InterstitialAd interstitial; private RewardedAd rewarded;
 private boolean adsInitialized=false,showing=false; private long lastAd=System.currentTimeMillis();
 @Override public void onCreate(Bundle state){
  super.onCreate(state);getWindow().setStatusBarColor(0xff101312);getWindow().setNavigationBarColor(0xff101312);
  web=new WebView(this);web.setBackgroundColor(0xff101312);setContentView(web);
  web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  final WebViewAssetLoader.AssetsPathHandler assets=new WebViewAssetLoader.AssetsPathHandler(this);
  final WebViewAssetLoader loader=new WebViewAssetLoader.Builder().setDomain(HOST).addPathHandler("/",path->assets.handle("www/"+(path.isEmpty()?"index.html":path))).build();
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest req){if(req.getUrl().getPath().startsWith("/api/"))return null;return loader.shouldInterceptRequest(req.getUrl());}
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){Uri u=req.getUrl();if("https".equals(u.getScheme())&&HOST.equals(u.getHost()))return false;if(req.isForMainFrame()&&"https".equals(u.getScheme()))startActivity(new Intent(Intent.ACTION_VIEW,u));return true;}
   @Override public void onReceivedSslError(WebView v,SslErrorHandler handler,android.net.http.SslError error){handler.cancel();}
  });
  if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.addWebMessageListener(web,"RiftNative",Collections.singleton(ORIGIN),(view,msg,origin,main,reply)->{
   if(!main||!ORIGIN.equals(origin.toString()))return;
   try{JSONObject data=new JSONObject(msg.getData());String id=data.optString("id"),action=data.optString("action");if(id.length()>80)return;
    switch(action){
     case "capabilities":respond(reply,id,"ready",false);break;
     case "share":String text=data.optString("text");if(text.length()>2000)return;Intent send=new Intent(Intent.ACTION_SEND);send.setType("text/plain");send.putExtra(Intent.EXTRA_TEXT,text);startActivity(Intent.createChooser(send,"Challenge a friend"));respond(reply,id,"finished",false);break;
     case "rewarded":showReward(reply,id);break;
     case "interstitial":showInterstitial(reply,id);break;
     case "privacy":UserMessagingPlatform.showPrivacyOptionsForm(this,error->respond(reply,id,"finished",false));break;
     default:respond(reply,id,"unavailable",false);
    }
   }catch(Exception ignored){}
  });
  getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){confirmExit();}});
  web.setWebChromeClient(new WebChromeClient());web.loadUrl(ORIGIN+"/");
  if(BuildConfig.ADS_ENABLED){consent=UserMessagingPlatform.getConsentInformation(this);consent.requestConsentInfoUpdate(this,new ConsentRequestParameters.Builder().build(),()->UserMessagingPlatform.loadAndShowConsentFormIfRequired(this,error->initializeAds()),error->initializeAds());initializeAds();}
 }
 private void initializeAds(){if(adsInitialized||consent==null||!consent.canRequestAds())return;adsInitialized=true;MobileAds.initialize(this,status->runOnUiThread(()->{loadInterstitial();loadReward();}));}
 private void loadInterstitial(){if(!BuildConfig.ADS_ENABLED||!adsInitialized||!consent.canRequestAds())return;InterstitialAd.load(this,BuildConfig.INTERSTITIAL_ID,new AdRequest.Builder().build(),new InterstitialAdLoadCallback(){@Override public void onAdLoaded(@NonNull InterstitialAd ad){interstitial=ad;}@Override public void onAdFailedToLoad(@NonNull LoadAdError e){interstitial=null;}});}
 private void loadReward(){if(!BuildConfig.ADS_ENABLED||!adsInitialized||!consent.canRequestAds())return;RewardedAd.load(this,BuildConfig.REWARDED_ID,new AdRequest.Builder().build(),new RewardedAdLoadCallback(){@Override public void onAdLoaded(@NonNull RewardedAd ad){rewarded=ad;}@Override public void onAdFailedToLoad(@NonNull LoadAdError e){rewarded=null;}});}
 private void respond(JavaScriptReplyProxy reply,String id,String status,boolean earned){if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))return;try{JSONObject o=new JSONObject();o.put("id",id);o.put("status",status);o.put("earned",earned);o.put("ads",BuildConfig.ADS_ENABLED&&adsInitialized);o.put("testAds",BuildConfig.DEBUG);o.put("rewardReady",rewarded!=null);o.put("privacyRequired",consent!=null&&consent.getPrivacyOptionsRequirementStatus()==ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);reply.postMessage(o.toString());}catch(Exception ignored){}}
 private void adEvent(String name){web.evaluateJavascript("window.dispatchEvent(new Event('"+name+"'))",null);}
 private void showInterstitial(JavaScriptReplyProxy reply,String id){
  if(showing||interstitial==null||System.currentTimeMillis()-lastAd<180000||consent==null||!consent.canRequestAds()){respond(reply,id,"unavailable",false);loadInterstitial();return;}
  showing=true;lastAd=System.currentTimeMillis();InterstitialAd ad=interstitial;interstitial=null;adEvent("rift-ad-start");
  ad.setFullScreenContentCallback(new FullScreenContentCallback(){@Override public void onAdDismissedFullScreenContent(){done();}@Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e){done();}private void done(){showing=false;adEvent("rift-ad-end");respond(reply,id,"finished",false);loadInterstitial();}});ad.show(this);
 }
 private void showReward(JavaScriptReplyProxy reply,String id){
  if(showing||rewarded==null||consent==null||!consent.canRequestAds()){respond(reply,id,"unavailable",false);loadReward();return;}
  showing=true;RewardedAd ad=rewarded;rewarded=null;final boolean[] earned={false};adEvent("rift-ad-start");
  ad.setFullScreenContentCallback(new FullScreenContentCallback(){@Override public void onAdDismissedFullScreenContent(){done();}@Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e){done();}private void done(){showing=false;lastAd=System.currentTimeMillis();adEvent("rift-ad-end");respond(reply,id,"finished",earned[0]);loadReward();}});ad.show(this,reward->earned[0]=true);
 }
 @Override protected void onPause(){super.onPause();web.evaluateJavascript("window.dispatchEvent(new Event('blur'))",null);web.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
 private void confirmExit(){web.evaluateJavascript("window.dispatchEvent(new Event('blur'))",null);new android.app.AlertDialog.Builder(this).setMessage("Leave the rift?").setPositiveButton("Exit",(d,w)->finish()).setNegativeButton("Stay",(d,w)->{}).show();}
}
