import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from korea_course import build
build('seongsamjae')
