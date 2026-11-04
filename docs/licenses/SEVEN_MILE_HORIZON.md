# Seven Mile Horizon · 생성/가공 기록

- 사용자 요청: 해변의 시원함을 느낄 수 있는 힙합풍 레이싱 BGM, 생성 결과 승인 후 게임 적용 요청.
- 생성 서비스: Gemini 음악 생성.
- 생성 대화: https://gemini.google.com/app/b93486e5f0fd27f4
- 요청 중 작업명은 Coastal Cruise; 실제 플레이어 표지/미디어 제목은 **Seven Mile Horizon**, Pacific Blue, West Coast Hip-Hop으로 표시됐다.
- 페이지에서 제공한 원본 MP4의 오디오 트랙을 FFmpeg로 추출했다. 커버 영상은 게임에 포함하지 않는다.
- 런타임 파일: `public/assets/audio/seven-mile-horizon.mp3`, 68.847166초, MP3, 44.1kHz 스테레오, 1,309,073바이트.
- 추출: `ffmpeg -i <원본.mp4> -vn -c:a libmp3lame -q:a 4 seven-mile-horizon.mp3`
- 원본 측정: 평균 −14.4dB, 피크 0dB. 게임 기본 음악 볼륨은 24%이며 사용자가 메뉴에서 조절한다.

이 문서는 생성·가공의 출처 기록이며 별도 라이선스 계약이나 상업 이용 권리 확인을 대신하지 않는다. 이번 작업에서 음원을 외부에 업로드하거나 공개 배포하지 않았다.
