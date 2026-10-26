"""Small Workbench art review renders, not runtime/game screenshots."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'artifacts/namak-highdetail-20261013/renders-final';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-sources/namak/namak-highdetail.blend'))
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.background_type='WORLD'
scene.world.color=(.32,.43,.5);scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=1
bpy.ops.object.camera_add();camera=bpy.context.object;camera.data.clip_end=6000;scene.camera=camera
layer=bpy.data.collections.get('Namak_Architecture_20261013')
views=[('civic',(350,-260,95),(495,88,27),335),('housing-v2',(380,-80,95),(150,-60,25),280),('river',(790,-480,130),(520,-765,8),470)]
if '--only' in sys.argv:views=[v for v in views if v[0]==sys.argv[sys.argv.index('--only')+1]]
for name,pos,look,scale in views:
 camera.location=pos;camera.rotation_euler=(Vector(look)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=scale
 for shown in [False,True]:
  layer.hide_render=not shown;scene.render.filepath=str(OUT/(name+('-after.png' if shown else '-before.png')))
  bpy.ops.render.render(write_still=True)
print('ART_REVIEW_RENDERED',OUT)
