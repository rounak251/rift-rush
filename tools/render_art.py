"""Original Rift Rush artwork. Run with Blender 4.2, Cycles CUDA. No external assets."""
import bpy, math, random, json, time
from mathutils import Vector
from pathlib import Path

random.seed(23010)
started = time.time()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'CUDA'
prefs.get_devices()
devices = []
for d in prefs.devices:
    d.use = d.type == 'CUDA'
    devices.append({'name':d.name,'type':d.type,'use':d.use})
assert any(d['use'] for d in devices), 'CUDA GPU required; refusing silent CPU fallback'
scene.cycles.device = 'GPU'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1280
scene.render.resolution_percentage = 100
scene.world.color = (0.006,0.009,0.022)
scene.view_settings.view_transform = 'AgX'

def material(name, color, metal=0, rough=.3, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color,1)
    p.inputs['Emission Strength'].default_value=emission
    return m

chrome=material('Midnight titanium',(.032,.045,.065),.9,.22)
black=material('Obsidian',(.012,.02,.028),.8,.26)
mint=material('Ion mint',(.19,1,.65),.45,.2,9)
violet=material('Ultraviolet',(.32,.07,1),.5,.18,6)
white=material('Starlight',(.75,.9,1),.1,.3,4)

def cube(loc,scale,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=3
        o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o

# Deep perspective runway, interrupted by a huge orbital portal.
cube((0,8,-.3),(32,70,.5),black)
for x in [-5,-2.5,2.5,5]: cube((x,8,-.035),(.035,70,.025),mint)
for y in range(-20,41,3): cube((0,y,-.03),(10,.025,.02),violet)
for ring, radius in enumerate([5.0,5.48,5.8]):
    for k in range(24):
        a=k*math.tau/24
        if (k+ring*3)%11==0: continue
        o=cube((math.cos(a)*radius,9+ring*.15,6+math.sin(a)*radius),(.68,.38,.16),mint if ring==0 else chrome,.04)
        o.rotation_euler[1]=-a+math.pi/2
for k in range(18):
    a=k*math.tau/18
    o=cube((math.cos(a)*6.25,9.3,6+math.sin(a)*6.25),(.16,.4,.65),violet if k%3==0 else chrome,.03)
    o.rotation_euler[1]=-a

# A low-poly, original needle-shaped spacecraft with glowing twin engines.
verts=[(0,-5,1),(-1.4,-2,1),(0,-1.3,1.7),(1.4,-2,1),(0,-2,.6)]
faces=[(0,1,2),(0,2,3),(0,3,4),(0,4,1),(1,4,3,2)]
mesh=bpy.data.meshes.new('Needle mesh');mesh.from_pydata(verts,[],faces);mesh.update()
ship=bpy.data.objects.new('The Needle',mesh);scene.collection.objects.link(ship);ship.data.materials.append(chrome)
for x in [-.72,.72]:
    cube((x,-1.8,1),(.12,2.3,.1),mint,.02)
    cube((x,.1,1),(.055,3.5,.045),mint)
cube((0,-2.6,1.46),(.2,1.1,.06),violet,.02)

for i in range(44):
    side=random.choice([-1,1]); x=side*random.uniform(7,19); y=random.uniform(-2,36);h=random.uniform(2,12)
    o=cube((x,y,h/2), (random.uniform(.5,1.7),random.uniform(.7,2),h),chrome,.08)
    if i%3==0: cube((x-.3,y-1,h/2),(.035,.02,h*.8),violet)
for i in range(26):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=random.uniform(.08,.42),location=(random.uniform(-6,6),random.uniform(0,15),random.uniform(1.4,9)))
    o=bpy.context.object;o.scale=(.6,.5,1.8);o.rotation_euler=(random.random(),random.random(),random.random());o.data.materials.append(mint if i%5==0 else chrome)
for i in range(90):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=6,ring_count=4,radius=random.uniform(.008,.025),location=(random.uniform(-24,24),35,random.uniform(5,25)))
    bpy.context.object.data.materials.append(white)

def area(loc,color,power,size,target):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area((2,-5,12),(.4,.9,1),2200,9,(0,5,1))
area((-8,6,8),(.4,.1,1),2800,8,(0,7,3))
area((0,10,7),(.25,1,.65),1800,8,(0,-3,0))
bpy.ops.object.camera_add(location=(9,-19,8))
camera=bpy.context.object;camera.rotation_euler=(Vector((0,5,4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=34;scene.camera=camera
scene.use_nodes=True
nodes=scene.node_tree.nodes;nodes.clear()
rl=nodes.new('CompositorNodeRLayers');glow=nodes.new('CompositorNodeGlare');glow.glare_type='FOG_GLOW';glow.quality='HIGH';glow.threshold=1.2
out=nodes.new('CompositorNodeComposite');scene.node_tree.links.new(rl.outputs['Image'],glow.inputs['Image']);scene.node_tree.links.new(glow.outputs['Image'],out.inputs['Image'])
scene.render.image_settings.file_format='PNG';scene.render.filepath='/root/rift-art.png'
bpy.ops.render.render(write_still=True)
Path('/root/render-evidence.json').write_text(json.dumps({'renderer':'Blender 4.2.3 / Cycles CUDA','devices':devices,'seconds':time.time()-started,'resolution':[1920,1280],'samples':64,'seed':23010},indent=2))
print('RIFT_RENDER_COMPLETE')
