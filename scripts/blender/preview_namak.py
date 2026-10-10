"""Render the actual editable Namak map for a track overview; no source edits."""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets-sources/namak/namak.blend'))
bpy.ops.object.camera_add(location=(1250,-1400,1550))
camera=bpy.context.object;camera.rotation_euler=(Vector((400,-300,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=1830;camera.data.clip_end=10000;bpy.context.scene.camera=camera
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.display.shading.background_type='WORLD'
scene.world.color=(.18,.22,.25);scene.render.resolution_x=1440;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=1.0
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
destination=Path(args[0]) if args else ROOT/'artifacts/namak-20261010/track-overview.png'
destination.parent.mkdir(parents=True,exist_ok=True)
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(destination)
bpy.ops.render.render(write_still=True)
