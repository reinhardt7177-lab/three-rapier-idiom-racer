# 현재 프로젝트와 이전 배포 삭제 · 2026-10-10

## 남겨 둔 프로젝트

- 작업 폴더: `D:\racing\three-rapier-idiom-racer`
- 게임: Blender + Three.js + Rapier 순수 웹 버전
- 실행 서버: 위 폴더의 Vite preview, 포트 5191
- 남악 게임: [로컬에서 실행](http://127.0.0.1:5191/?track=namak)
- GitHub: [현재 저장소](https://github.com/reinhardt7177-lab/three-rapier-idiom-racer)
- 차량·맵·운전석 Blender 원본, 웹 소스, 현재 변경사항과 Git 기록을 보존했다. 현재 저장소의 별도 Vercel 배포 연결은 이번 삭제 대상에 포함하지 않았다.

## 이전 Unity 배포 정리

사용자가 현재 프로젝트 이외의 폴더와 연결된 GitHub·배포를 삭제하도록 요청했다.

- 이전 로컬 배포 폴더 `D:\racing\publish\mumu-circuit-unity-web`는 작업 시작 시 이미 존재하지 않았다. 이번 작업에서 이 폴더를 삭제한 것은 아니다.
- GitHub API에서 이전 저장소 이름, 소유자, Unity WebGL 설명, `Build`·`TemplateData` 폴더와 Pages 연결을 확인했다.
- `reinhardt7177-lab/mumu-circuit-unity-web`의 GitHub Pages를 삭제한 뒤 저장소를 삭제했다. 두 삭제 요청은 성공했다.
- 삭제 후 인증된 GitHub API의 이전 저장소·Pages 조회는 모두 HTTP 404였다.
- 이전 공개 주소 `https://reinhardt7177-lab.github.io/mumu-circuit-unity-web/`의 HEAD 요청도 HTTP 404였다.

## 이번 확인과 한계

- `D:\racing`의 직접 하위 디렉터리는 현재 프로젝트 하나다.
- 현재 Git remote는 `reinhardt7177-lab/three-rapier-idiom-racer`로 유지된다.
- 현재 남악 게임의 HTTP 응답은 200이다. 이번에는 게임 로직이나 그래픽을 수정하지 않았고 주행 회귀 검사는 다시 실행하지 않았다.
- 이미 사라진 이전 배포 폴더 때문에 정리 목록 도구가 실패하지 않도록 존재 여부 확인을 추가했다. 이 도구는 파일을 삭제하지 않는다.
- 이번 작업에서 로컬 파일을 삭제하지 않았으므로 추가 확보한 로컬 용량은 0바이트다.
- 현재 로컬 변경을 커밋·푸시하거나 새로 배포하지 않았다.
