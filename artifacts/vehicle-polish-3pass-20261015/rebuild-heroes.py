import sys,runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
script=ROOT/'scripts/blender/polish_vehicle_reference.py'
for stage in [1,2,3]:
 sys.argv=[str(script),'--pass',str(stage),'--only','supra,huracan']
 runpy.run_path(str(script),run_name='__main__')
