import React, { useEffect, useRef, useState } from 'react';
import { CHAPTERS, CHAPTER_ONE } from './campaign.js';
import { formatTime } from '../driving/sprint.js';
import './campaign.css';

export function CampaignBoard({ profile, saved, onClose, onStart }) {
  const dialog = useRef(null);
  const [difficulty, setDifficulty] = useState('standard');
  useEffect(() => { const el = dialog.current; el.showModal(); return () => el.close(); }, []);
  function close() { dialog.current.close(); onClose(); }
  function keepFocus(event) {
    if (event.key !== 'Tab') return;
    const targets = [...dialog.current.querySelectorAll('button:not(:disabled),select:not(:disabled),[href],input:not(:disabled),[tabindex="0"]')];
    const first = targets[0], last = targets[targets.length - 1];
    if (!targets.length) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !targets.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !targets.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  return <dialog ref={dialog} className="campaign-board" aria-label="해안 클럽 챕터" onKeyDown={keepFocus} onCancel={e => { e.preventDefault(); close(); }}>
    <header className="campaign-heading"><div><span>COASTLINE / HORIZON CLUB</span><h2>우리의 출발선</h2></div><button autoFocus onClick={close} aria-label="챕터 선택 닫기">닫기 ×</button></header>
    <div className="campaign-content">
      <section className="campaign-current" aria-labelledby="chapter-one-title">
        <span className="chapter-number">CHAPTER 01 / BEACH DAYLIGHT</span>
        <h3 id="chapter-one-title">{CHAPTER_ONE.title}</h3>
        <p>작은 항구 정비소에서 시작해 해안 클럽의 드라이버가 됩니다. 첫 초대장에는 민서가 남긴 테스트 기록이 적혀 있습니다.</p>
        <blockquote>“직선의 속도보다, 코너를 빠져나오는 순간을 보여 줘.”<cite>민서 · 클럽 드라이버</cite></blockquote>
        <dl><div><dt>무대</dt><dd>항만 직선 → S커브 → 바람곶</dd></div><div><dt>성공 조건</dt><dd>계측선 3개 · 유효 완주 {CHAPTER_ONE.targets[difficulty]}초 이내</dd></div><div><dt>첫 보상</dt><dd>차고의 클럽 라이선스 01</dd></div></dl>
        <p className="campaign-honesty">민서의 기준 시간에 도전합니다. 유효 완주 뒤에는 내 기록 고스트와 함께 달릴 수 있습니다. 라이벌 AI·입장료·실패 비용은 없습니다.</p>
        <label className="campaign-difficulty">챕터 난이도<select aria-label="챕터 난이도" value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="standard">표준 · 45초</option><option value="relaxed">여유롭게 · 60초</option></select></label>
        <button className="chapter-launch" onClick={() => onStart(difficulty)}>1장 시작 →</button>
        {profile.license && <p className="campaign-license" role="status">라이선스 01 · {formatTime(profile.chapterOne.time)} · {profile.chapterOne.difficulty === 'relaxed' ? '여유롭게' : '표준'} 완주 기록</p>}
        {saved === false && <p className="campaign-save-warning" role="status">저장할 수 없어 이번 방문에서만 기록을 유지합니다. 새로고침하면 사라질 수 있습니다.</p>}
      </section>
      <nav className="campaign-chapters" aria-label="챕터 제작 로드맵"><p>해안 클럽 시즌 01</p><ol>{CHAPTERS.map((c, i) => <li key={c.id} data-chapter-card={c.id} data-chapter-number={i + 1} data-playable={c.playable} aria-current={i === 0 ? 'step' : undefined}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{c.title}</h3><p>{c.summary}</p><small>{c.playable ? profile.license ? '플레이 가능 · 클리어' : '지금 플레이 가능' : '제작 예정 · 플레이 불가'}</small></div></li>)}</ol><p className="campaign-honesty">6장 기획 중 1장만 플레이할 수 있습니다. 이후 장은 구현·검증 후 순서대로 추가합니다.</p></nav>
    </div>
  </dialog>;
}
