# Slipstream Pursuit · 생성/가공 기록

- 사용자 요청으로 생성한 첫 번째 레이싱 BGM. 2026-10-10 사용자가 두 곡 모두 게임에 넣고 선택하도록 요청해 포함했다.
- 생성 서비스: Gemini 음악 생성.
- 생성 대화: https://gemini.google.com/app/1087de255f01d67b
- 원본 미디어 제목: **Slipstream Pursuit**, 앨범 Velocity Ritual, 장르 Synthwave. 프롬프트는 보컬 없는 140 BPM 신스웨이브.
- 페이지가 제공한 원본 MP4에서 FFmpeg로 오디오를 추출했다. 영상 표지는 게임에 포함하지 않는다.
- 파일: `public/assets/audio/slipstream-pursuit.mp3`, MP3, 44.1kHz 스테레오, 62.809977초, 1,113,682바이트.
- 추출: `ffmpeg -i <원본.mp4> -vn -c:a libmp3lame -q:a 4 slipstream-pursuit.mp3`
- 디코딩 검사: 평균 −14.3dB, 피크 약0dB. 기존 해변 힙합(평균−14.4dB)과 같은 게임 볼륨 24%를 기본으로 사용한다.

최초 탭의 원본 다운로드 링크가 만료되어 에셋 저장에 실패했다. 기존 사용자 입력 초안을 보존하고 같은 생성 대화를 별도 임시 탭에 열어 갱신된 미디어를 가져왔다. 새 곡을 생성하거나 기존 대화·초안을 수정하지 않았다.

이 문서는 생성·가공 출처를 기록한다. 상업 이용 권리 확인을 대신하지 않으며 이번 작업에서 외부 업로드·공개 배포는 수행하지 않았다.
