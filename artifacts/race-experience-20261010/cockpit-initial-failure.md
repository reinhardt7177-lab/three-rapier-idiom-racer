# 운전석 최초 수출 검증 실패 기록

2026-10-10 `node --test scripts/cockpit.test.mjs` 최초 실행: 3개 중 2개 통과, 1개 실패.

실패: `Blender GLB retains editable independent steering/gauge pivots and stays inside a small web asset budget`의 `assert.ok(triangles<45000)`.

최초 메시 합계는 53,744삼각형, 1,611,148바이트였다. 글자 곡선 해상도·입체 두께와 베벨·원형 분할을 줄여 기준을 바꾸지 않고 다시 수출했다. 최종 21,678삼각형, 617,448바이트. 최종 자동 시험 전체 147개 통과 결과는 `check-blender-cockpit-final.log`를 따른다.

최초 브라우저 확인에서 앞유리 기둥·핸들 스포크가 의도한 각도 대신 수직으로 보였다. 회전 모드 설정 뒤 quaternion을 적용하도록 생성 스크립트를 수정했다. 세로 화면에서는 핸들이 크게 표시되어 도로를 가렸다. 운전석 그룹을 카메라 기준 뒤/아래로 옮겨 개선했다.
