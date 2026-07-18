import { useEffect, useRef, useState } from "react";
import { CITY_HALF, CITY_RIVER_PATH, CITY_ROADS } from "./city-map.js";
import { buildRoadRoute, createDeliveryRuntime, routeLength } from "./create-delivery-runtime.js";
import { DECALS, DEFAULT_STYLE, DESTINATIONS, MAX_WORKSHOP_LEVEL, PAINTS, TOPPERS, VEHICLES, WHEELS, workshopPrice } from "./game-data.js";
import { RANKS, generateContracts, rankForXp } from "./contracts.js";

const initialHud = {
  status: "garage",
  speed: 0,
  speedLimit: 200,
  boost: 100,
  timeLeft: 0,
  worldTime: "07:40",
  score: 0,
  stars: 0,
  deliveries: 0,
  totalDeliveries: 3,
  x: 0,
  z: 0,
  heading: 0,
  relativeAngle: 0,
  targetDistance: 0,
  directDistance: 0,
  nearTarget: false,
  navigation: { kind: "straight", label: "경로 계산 중", relativeAngle: 0 },
  routePoints: [],
  target: null,
  district: { name: "센트럴 배송 허브", color: "#247ba0" },
  mission: null
};

const MAP_HALF = CITY_HALF;

function missionRouteDistance(mission) {
  let current = { x: 0, z: 0 };
  return mission.stops.reduce((total, stopId) => {
    const target = DESTINATIONS[stopId];
    const distance = routeLength(buildRoadRoute(current.x, current.z, target));
    current = target;
    return total + distance;
  }, 0);
}

function loadStyle() {
  try {
    const saved = JSON.parse(localStorage.getItem("mumu-delivery-style") || "null");
    if (!saved) return DEFAULT_STYLE;
    return {
      paint: PAINTS.find((item) => item.id === saved.paint) || DEFAULT_STYLE.paint,
      wheel: WHEELS.find((item) => item.id === saved.wheel) || DEFAULT_STYLE.wheel,
      topper: TOPPERS.find((item) => item.id === saved.topper) || DEFAULT_STYLE.topper,
      decal: DECALS.find((item) => item.id === saved.decal) || DEFAULT_STYLE.decal,
      vehicle: VEHICLES.find((item) => item.id === saved.vehicle) || DEFAULT_STYLE.vehicle
    };
  } catch {
    return DEFAULT_STYLE;
  }
}

const EMPTY_PROGRESS = { gold: 0, owned: [VEHICLES[0].id], upgrades: {}, xp: 0, wanted: [] };

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem("mumu-delivery-progress") || "null");
    if (!saved) return { ...EMPTY_PROGRESS };
    return {
      gold: Math.max(0, Number(saved.gold) || 0),
      owned: Array.from(new Set([VEHICLES[0].id, ...(saved.owned || [])])).filter((id) => VEHICLES.some((vehicle) => vehicle.id === id)),
      upgrades: saved.upgrades && typeof saved.upgrades === "object" ? saved.upgrades : {},
      xp: Math.max(0, Number(saved.xp) || 0),
      wanted: Array.isArray(saved.wanted)
        ? saved.wanted.filter((item) => item && item.packId && item.key).slice(0, 24)
        : []
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export default function App() {
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const messageTimerRef = useRef(null);
  const quizTimerRef = useRef(null);
  const [screen, setScreen] = useState("garage");
  const [style, setStyle] = useState(loadStyle);
  const [previewVehicle, setPreviewVehicle] = useState(null);
  const [progress, setProgress] = useState(loadProgress);
  const rank = rankForXp(progress.xp);
  const [contractSeed, setContractSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [contracts, setContracts] = useState(() => generateContracts(contractSeed, rankForXp(loadProgress().xp).index));
  const [mission, setMission] = useState(() => contracts[0]);
  const [hud, setHud] = useState(initialHud);
  const [quiz, setQuiz] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("차를 꾸미고 첫 배송을 시작해요!");
  const [audioOn, setAudioOn] = useState(true);
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(orientation: portrait)").matches
  );
  const isTouchDevice = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const onOrientationChange = () => setIsPortrait(query.matches);
    query.addEventListener("change", onOrientationChange);
    return () => query.removeEventListener("change", onOrientationChange);
  }, []);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    runtimeRef.current = createDeliveryRuntime({
      mount: mountRef.current,
      initialStyle: style,
      onHud: setHud,
      onDelivery: (payload) => {
        setQuiz(payload);
        setQuizResult(null);
      },
      onFinish: (payload) => {
        const bonusGold = payload.bonus?.achieved ? payload.bonus.reward : 0;
        const totalGold = (payload.reward || 0) + (payload.goldEarned || 0) + bonusGold;
        setProgress((current) => ({
          ...current,
          gold: current.gold + totalGold,
          xp: current.xp + Math.round(Math.max(0, payload.score || 0))
        }));
        setResult({ ...payload, totalGold, bonusGold });
        setQuiz(null);
        setScreen("result");
      },
      onQuizOutcome: (packId, key, correct) => {
        if (!key) return;
        setProgress((current) => {
          const wanted = current.wanted.filter((item) => !(item.packId === packId && item.key === key));
          if (!correct) wanted.unshift({ packId, key });
          return { ...current, wanted: wanted.slice(0, 24) };
        });
      },
      onMessage: showMessage
    });

    const keyDown = (event) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") runtimeRef.current?.setInput({ left: true });
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") runtimeRef.current?.setInput({ right: true });
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") runtimeRef.current?.setInput({ accel: true });
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") runtimeRef.current?.setInput({ brake: true });
      if (event.key === " " || event.key === "Shift") runtimeRef.current?.setInput({ boost: true });
      if (["1", "2", "3", "4"].includes(event.key)) answerQuiz(Number(event.key) - 1);
    };
    const keyUp = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") runtimeRef.current?.setInput({ left: false });
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") runtimeRef.current?.setInput({ right: false });
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") runtimeRef.current?.setInput({ accel: false });
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") runtimeRef.current?.setInput({ brake: false });
      if (event.key === " " || event.key === "Shift") runtimeRef.current?.setInput({ boost: false });
    };
    const releaseControls = () => runtimeRef.current?.setInput({ left: false, right: false, accel: false, brake: false, boost: false });
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", releaseControls);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", releaseControls);
      if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
      if (quizTimerRef.current) window.clearTimeout(quizTimerRef.current);
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const displayedVehicle = screen === "garage" && previewVehicle ? previewVehicle : style.vehicle;
    const upgrades = progress.upgrades[displayedVehicle.id] || { speed: 0, handling: 0 };
    runtimeRef.current?.setStyle({ ...style, vehicle: displayedVehicle, upgrades });
    try {
      localStorage.setItem("mumu-delivery-style", JSON.stringify({
        paint: style.paint.id,
        wheel: style.wheel.id,
        topper: style.topper.id,
        decal: style.decal.id,
        vehicle: style.vehicle.id
      }));
    } catch {
      // Customization still works for the current session when storage is unavailable.
    }
  }, [style, progress.upgrades, screen, previewVehicle]);

  useEffect(() => {
    try {
      localStorage.setItem("mumu-delivery-progress", JSON.stringify(progress));
    } catch {
      // Progress remains available for the current session when storage is unavailable.
    }
  }, [progress]);

  useEffect(() => {
    if (!progress.owned.includes(style.vehicle.id)) {
      setStyle((current) => ({ ...current, vehicle: VEHICLES[0] }));
    }
  }, [progress.owned, style.vehicle.id]);

  function showMessage(text) {
    setMessage(text);
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => setMessage(""), 2200);
  }

  function refreshContracts(xp = progress.xp) {
    const seed = Math.floor(Math.random() * 100000);
    const board = generateContracts(seed, rankForXp(xp).index);
    setContractSeed(seed);
    setContracts(board);
    setMission(board[0]);
  }

  function startMission() {
    setPreviewVehicle(null);
    setResult(null);
    setQuiz(null);
    setQuizResult(null);
    setScreen("playing");
    // 모바일은 전체화면 + 가로 잠금을 시도한다 (브라우저가 거부하면 회전 안내 오버레이가 대신한다).
    if (isTouchDevice && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
        .then(() => window.screen?.orientation?.lock?.("landscape"))
        .catch(() => {});
    }
    runtimeRef.current?.startMission(mission, { wanted: progress.wanted });
  }

  function answerQuiz(index) {
    const answer = runtimeRef.current?.answerQuiz(index);
    if (!answer) return;
    setQuizResult(answer);
    if (quizTimerRef.current) window.clearTimeout(quizTimerRef.current);
    quizTimerRef.current = window.setTimeout(() => {
      setQuiz(null);
      setQuizResult(null);
    }, 900);
  }

  function returnToGarage() {
    setPreviewVehicle(null);
    setScreen("garage");
    setQuiz(null);
    setResult(null);
    refreshContracts();
    runtimeRef.current?.returnToGarage();
  }

  function selectVehicle(vehicle) {
    if (progress.owned.includes(vehicle.id)) {
      setStyle((current) => ({ ...current, vehicle }));
      return;
    }
    if (rank.index < (vehicle.rankReq || 0)) {
      showMessage(`${RANKS[vehicle.rankReq].name} 등급부터 구매할 수 있어요`);
      return;
    }
    if (progress.gold < vehicle.price) {
      showMessage(`${(vehicle.price - progress.gold).toLocaleString()}G가 더 필요해요`);
      return;
    }
    setProgress((current) => ({ ...current, gold: current.gold - vehicle.price, owned: [...current.owned, vehicle.id] }));
    setStyle((current) => ({ ...current, vehicle }));
    showMessage(`${vehicle.name} 구매 완료!`);
  }

  function upgradeVehicle(type) {
    const vehicleId = style.vehicle.id;
    const currentUpgrade = progress.upgrades[vehicleId] || { speed: 0, handling: 0 };
    const level = currentUpgrade[type] || 0;
    if (level >= MAX_WORKSHOP_LEVEL) return;
    const price = workshopPrice(level, type);
    if (progress.gold < price) {
      showMessage(`${(price - progress.gold).toLocaleString()}G가 더 필요해요`);
      return;
    }
    setProgress((current) => ({
      ...current,
      gold: current.gold - price,
      upgrades: { ...current.upgrades, [vehicleId]: { ...currentUpgrade, [type]: level + 1 } }
    }));
    showMessage(`${type === "speed" ? "속도" : "핸들링"} 튜닝 +1`);
  }

  const vehicleUpgrades = progress.upgrades[style.vehicle.id] || { speed: 0, handling: 0 };
  const stats = {
    speed: Math.min(10, style.wheel.speed + style.vehicle.speed + vehicleUpgrades.speed),
    accel: Math.min(10, style.wheel.accel + style.vehicle.accel),
    handling: Math.min(10, style.wheel.handling + style.vehicle.handling + vehicleUpgrades.handling)
  };

  return (
    <main className="app-shell">
      <div className="game-stage">
        <div ref={mountRef} className="three-mount" />
        <div className="sun-wash" />

        <header className="topbar">
          <div className="brand-lockup">
            <span className="brand-mark">M</span>
            <div>
              <strong>무무 시티익스프레스</strong>
              <span>CITY EXPRESS RACER</span>
            </div>
          </div>
          <div className="top-actions">
            <button className="icon-button" type="button" onClick={() => setAudioOn((value) => { runtimeRef.current?.setMuted(value); return !value; })} aria-label="소리 켜기 또는 끄기">
              {audioOn ? "🔊" : "🔇"}
            </button>
            {screen === "playing" ? (
              <>
                <button className="garage-mini camera-reset" type="button" onClick={() => runtimeRef.current?.resetCamera()}>시점 원위치</button>
                <button className="garage-mini" type="button" onClick={returnToGarage}>차고로</button>
              </>
            ) : null}
          </div>
        </header>

        {screen === "garage" ? (
          <Garage
            style={style}
            setStyle={setStyle}
            mission={mission}
            setMission={setMission}
            contracts={contracts}
            rank={rank}
            stats={stats}
            progress={progress}
            previewVehicle={previewVehicle}
            upgrades={vehicleUpgrades}
            onSelectVehicle={selectVehicle}
            onPreviewVehicle={setPreviewVehicle}
            onUpgrade={upgradeVehicle}
            onStart={startMission}
            onRefresh={() => refreshContracts()}
          />
        ) : null}

        {screen === "playing" ? (
          <>
            <GameHud hud={hud} />
            <MiniMap hud={hud} />
            <Controls runtimeRef={runtimeRef} />
            {message ? <div className="toast-message">{message}</div> : null}
          </>
        ) : null}

        {quiz ? <DeliveryQuiz quiz={quiz} result={quizResult} onAnswer={answerQuiz} /> : null}
        {screen === "result" && result ? (
          <ResultScreen result={result} onRetry={startMission} onGarage={returnToGarage} />
        ) : null}

        {screen === "playing" && isTouchDevice && isPortrait ? (
          <div className="rotate-overlay" role="alert">
            <span className="rotate-phone">📱</span>
            <strong>가로 모드로 돌려주세요</strong>
            <small>무무 시티는 가로 화면에서 제일 잘 달려요!</small>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Garage({ style, setStyle, mission, setMission, contracts, rank, stats, progress, previewVehicle, upgrades, onSelectVehicle, onPreviewVehicle, onUpgrade, onStart, onRefresh }) {
  const displayedVehicle = previewVehicle || style.vehicle;
  const nextRankXp = rank.next ? rank.next.xp : null;
  return (
    <section className="garage-screen">
      <div className="garage-copy">
        <span className="eyebrow">OPEN CITY DELIVERY RACING</span>
        <h1>도심을 가로질러,<br /><em>하버까지 전력 질주!</em></h1>
        <p>계약을 골라 배달하고, 도로 위 학습 게이트를 정답 차선으로 통과하세요.</p>
        <div className="gold-wallet">
          <span>🪙 보유 골드</span><strong>{progress.gold.toLocaleString()} G</strong>
          <span style={{ marginLeft: 12 }}>{rank.icon} {rank.name}</span>
          <strong style={{ color: rank.color }}>
            {nextRankXp ? `${progress.xp.toLocaleString()} / ${nextRankXp.toLocaleString()} XP` : `${progress.xp.toLocaleString()} XP`}
          </strong>
        </div>
        {progress.wanted.length ? (
          <div className="gold-wallet" style={{ marginTop: 6 }}>
            <span>🚨 수배 문제</span>
            <strong>{progress.wanted.length}건 — 게이트에서 다시 만나요 (해제 시 보상 1.5배)</strong>
          </div>
        ) : null}
        <div className="mission-picker" aria-label="배송 계약 선택">
          {contracts.map((item) => (
            <button
              type="button"
              key={item.id}
              className={mission.id === item.id ? "mission-chip active" : "mission-chip"}
              onClick={() => setMission(item)}
            >
              <span>{item.rival ? "🏁" : item.pack.icon}</span>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.time}초 · {item.stops.length}곳 · 🪙 {item.reward.toLocaleString()}G
                  {item.bonus ? ` · ${item.bonus.icon} ${item.bonus.label} +${item.bonus.reward}G` : item.rival ? ` · 라이벌 ${item.rival.kmh}km/h와 대결` : ""}
                </small>
              </span>
            </button>
          ))}
          <button type="button" className="mission-chip" onClick={onRefresh}>
            <span>🔄</span>
            <span><strong>새 계약 받기</strong><small>계약 보드를 다시 생성합니다</small></span>
          </button>
        </div>
        <div className="mission-route-preview">
          <span><b>오늘의 배송 순서</b><small>약 {(missionRouteDistance(mission) / 1000).toFixed(1)}km</small></span>
          <div>
            {mission.stops.map((stopId, index) => {
              const stop = DESTINATIONS[stopId];
              return <span key={stopId}><i>{index + 1}</i>{stop.icon}<strong>{stop.short}</strong>{index < mission.stops.length - 1 ? <em>›</em> : null}</span>;
            })}
          </div>
        </div>
        <button className="start-delivery" type="button" onClick={onStart}>
          <span>배송 출발</span><b>→</b>
        </button>
        <div className="quest-howto" aria-label="퀘스트 해결 순서">
          <span><b>1</b> 주문 선택</span><em>›</em><span><b>2</b> 차량 위 내비</span><em>›</em><span><b>3</b> 배달 암호</span>
        </div>
        <span className="keyboard-help">키보드: 방향키/WASD · 스페이스바 터보 · 왼쪽 마우스 드래그: 시점 회전</span>
      </div>

      <div className="customizer-card">
        <div className="customizer-heading">
          <div><span>MY PERFORMANCE CAR · HOVER TO PREVIEW</span><strong>{displayedVehicle.name}</strong><small>{displayedVehicle.subtitle}</small></div>
          <span className="car-number">{String(VEHICLES.findIndex((vehicle) => vehicle.id === displayedVehicle.id) + 1).padStart(2, "0")}</span>
        </div>
        <div className="vehicle-shop" aria-label="차량 상점">
          {VEHICLES.map((vehicle) => {
            const owned = progress.owned.includes(vehicle.id);
            const locked = !owned && rank.index < (vehicle.rankReq || 0);
            return (
              <button
                type="button"
                key={vehicle.id}
                className={style.vehicle.id === vehicle.id ? "vehicle-card selected" : previewVehicle?.id === vehicle.id ? "vehicle-card previewing" : "vehicle-card"}
                onClick={() => onSelectVehicle(vehicle)}
                onPointerEnter={() => onPreviewVehicle(vehicle)}
                onPointerLeave={() => onPreviewVehicle(null)}
                onFocus={() => onPreviewVehicle(vehicle)}
                onBlur={() => onPreviewVehicle(null)}
                title={`${vehicle.name} 3D 미리보기`}
              >
                <span style={{ background: vehicle.color, opacity: locked ? 0.45 : 1 }}>{vehicle.icon}</span>
                <small>{vehicle.name}</small>
                <b>{owned ? (style.vehicle.id === vehicle.id ? "사용 중" : "보유") : locked ? `🔒 ${RANKS[vehicle.rankReq].name}` : `${vehicle.price.toLocaleString()}G`}</b>
              </button>
            );
          })}
        </div>
        <div className="workshop-panel">
          <span><b>🔧 시티 튜닝숍</b><small>차량별 최대 {MAX_WORKSHOP_LEVEL}단계</small></span>
          {["speed", "handling"].map((type) => {
            const level = upgrades[type] || 0;
            const maxed = level >= MAX_WORKSHOP_LEVEL;
            return <button type="button" key={type} disabled={maxed} onClick={() => onUpgrade(type)}><span>{type === "speed" ? "⚡ 속도" : "🛞 핸들링"} Lv.{level}</span><b>{maxed ? "MAX" : `${workshopPrice(level, type).toLocaleString()}G`}</b></button>;
          })}
        </div>
        <OptionRow label="페인트" items={PAINTS} selected={style.paint.id} onSelect={(paint) => setStyle({ ...style, paint })} render={(item) => <span className="paint-dot" style={{ background: item.body }} />} />
        <OptionRow label="바퀴" items={WHEELS} selected={style.wheel.id} onSelect={(wheel) => setStyle({ ...style, wheel })} render={(item) => <span className="wheel-dot" style={{ borderColor: item.color }} />} />
        <OptionRow label="지붕 장식" items={TOPPERS} selected={style.topper.id} onSelect={(topper) => setStyle({ ...style, topper })} render={(item) => <span className="option-emoji">{item.icon}</span>} />
        <OptionRow label="스티커" items={DECALS} selected={style.decal.id} onSelect={(decal) => setStyle({ ...style, decal })} render={(item) => <span className="option-emoji">{item.icon}</span>} />
        <div className="stat-board">
          <Stat label="최고 속도" value={stats.speed} color="#ff595e" />
          <Stat label="가속" value={stats.accel} color="#ffca3a" />
          <Stat label="핸들링" value={stats.handling} color="#44c767" />
        </div>
      </div>
    </section>
  );
}

function OptionRow({ label, items, selected, onSelect, render }) {
  return (
    <div className="option-row">
      <span className="option-label">{label}</span>
      <div className="option-list">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={selected === item.id ? "option-button selected" : "option-button"}
            onClick={() => onSelect(item)}
            title={item.name}
            aria-label={item.name}
          >
            {render(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="stat-row"><span>{label}</span><div>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => <i key={step} style={{ background: step <= value ? color : "#dfe7ed" }} />)}</div></div>
  );
}

function GameHud({ hud }) {
  const seconds = Math.max(0, Math.ceil(hud.timeLeft));
  const urgent = seconds <= 20;
  const speedRatio = Math.max(0, Math.min(1.15, hud.speed / Math.max(1, hud.speedLimit ?? 200)));
  const needleAngle = -128 + Math.min(1, speedRatio) * 256;
  const rushOpacity = hud.boosting ? 0.5 : Math.max(0, (hud.speedRatio ?? 0) - 0.72) * 0.9;
  return (
    <div className="hud-layer">
      {rushOpacity > 0.02 ? (
        <div
          className="speed-rush"
          style={{
            opacity: rushOpacity,
            background: hud.overdrive
              ? "radial-gradient(ellipse at center, transparent 46%, rgba(255,110,40,.42) 100%)"
              : "radial-gradient(ellipse at center, transparent 52%, rgba(120,200,255,.32) 100%)"
          }}
        />
      ) : null}
      <section className="mission-card">
        <div className="mission-meta"><span className="hud-caption">NOW DELIVERING</span><span className="district-pill" style={{ background: hud.district?.color }}>{hud.district?.name}</span></div>
        <div className="destination-line"><span>{hud.target?.icon || "📦"}</span><div><strong>{hud.target?.name || "목적지 찾는 중"}</strong><small>{hud.target?.package || "안전하게 운전해요"}</small></div></div>
        <div className="distance-row"><b>{hud.targetDistance}m</b><span>남음</span></div>
        <div className="route-progress" aria-label={`배송 진행 ${hud.deliveries}/${hud.totalDeliveries}`}>
          {Array.from({ length: hud.totalDeliveries }, (_, index) => <i key={index} className={index < hud.deliveries ? "done" : index === hud.deliveries ? "active" : ""} />)}
        </div>
      </section>

      <section className="race-stats">
        <div className="world-time-stat"><small>CITY TIME</small><strong>{hud.worldTime || "--:--"}</strong></div>
        <div className={urgent ? "time-stat urgent" : "time-stat"}><small>남은 시간</small><strong>{seconds}</strong><span>초</span></div>
        <div><small>배달</small><strong>{hud.deliveries}/{hud.totalDeliveries}</strong></div>
        <div><small>점수</small><strong>{Math.round(hud.score).toLocaleString()}</strong></div>
        <div><small>획득 골드</small><strong>🪙{(hud.goldEarned || 0).toLocaleString()}</strong></div>
        {hud.rivalStatus ? (
          <div className={hud.rivalStatus.finished ? "time-stat urgent" : undefined}>
            <small>🏁 라이벌</small>
            <strong>{hud.rivalStatus.finished ? "도착!" : `${Math.round(hud.rivalStatus.progress * 100)}%`}</strong>
          </div>
        ) : null}
        {hud.bonusStatus ? (
          <div>
            <small>{hud.bonusStatus.icon} 보너스</small>
            <strong>
              {hud.bonusStatus.type === "noCrash"
                ? (hud.bonusStatus.current === 0 ? "무충돌 유지 중" : "실패")
                : `${hud.bonusStatus.current}/${hud.bonusStatus.target}`}
            </strong>
          </div>
        ) : null}
      </section>

      <section className={hud.overdrive ? "speed-meter overdrive" : "speed-meter"} aria-label={`현재 속도 ${hud.speed}km/h`}>
        <div className="tachometer">
          <i className="tach-needle" style={{ transform: `translateX(-50%) rotate(${needleAngle}deg)` }} />
          <div className="tach-readout">
            <strong style={hud.overdrive ? { color: "#ff5d2e" } : undefined}>{hud.speed}</strong>
            <span>km/h · {hud.gear ?? 1}단{hud.drifting ? " · DRIFT" : ""}</span>
          </div>
        </div>
        <div className="boost-track"><i style={{ width: `${hud.boost}%`, background: hud.overdrive ? "#ff5d2e" : undefined }} /></div>
        <small>{hud.overdrive ? "OVERDRIVE!" : `NITRO ${Math.round(hud.boost)}%`} · LIMIT {hud.speedLimit ?? 200}km/h</small>
      </section>
      {hud.nearTarget ? <div className="delivery-approach">📦 감속 · 배달존 진입</div> : null}
    </div>
  );
}

function MiniMap({ hud }) {
  const project = (value) => ((value + MAP_HALF) / (MAP_HALF * 2)) * 164 + 8;
  const px = project(hud.x);
  const py = project(hud.z);
  const tx = hud.target ? project(hud.target.x) : 90;
  const ty = hud.target ? project(hud.target.z) : 90;
  const routePoints = (hud.routePoints || []).map((point) => `${project(point.x)},${project(point.z)}`).join(" ");
  const riverPoints = CITY_RIVER_PATH.map((point) => `${project(point.x)},${project(point.z)}`).join(" ");
  return (
    <aside className="minimap-card" aria-label="시티 배송 지도">
      <div className="map-heading"><strong>시티 배송 지도</strong><span>🏁 3 · ★ {hud.stars}</span></div>
      <svg viewBox="0 0 180 180" role="img" aria-label="현재 위치와 배송 목적지">
        <rect x="4" y="4" width="172" height="172" rx="18" fill="#dce9e7" />
        <ellipse cx="43" cy="47" rx="38" ry="34" fill="#f7fbff" opacity=".8" />
        <ellipse cx="43" cy="104" rx="35" ry="26" fill="#9a7b69" opacity=".28" />
        <ellipse cx="140" cy="53" rx="36" ry="34" fill="#c8d8df" opacity=".54" />
        <ellipse cx="102" cy="146" rx="61" ry="25" fill="#79c7d6" opacity=".45" />
        <polyline points={riverPoints} fill="none" stroke="#45b7e8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        {CITY_ROADS.map((road) => {
          const points = road.path.map((point) => `${project(point.x)},${project(point.z)}`).join(" ");
          const width = road.type === "arterial" ? 4.1 : road.type === "collector" ? 3 : 1.8;
          if (road.type === "alley") {
            return <polyline key={road.id} points={points} fill="none" stroke="#9fc9dc" strokeWidth="1.4" strokeDasharray="3 2.4" strokeLinecap="round" strokeLinejoin="round" />;
          }
          return <polyline key={road.id} points={points} fill="none" stroke={road.skyway ? "#ffb44c" : road.bridge ? "#ffd166" : road.type === "arterial" ? "#506879" : "#81939e"} strokeWidth={road.bridge || road.skyway ? width + 1.4 : width} strokeLinecap="round" strokeLinejoin="round" />;
        })}
        <g fill="#264653" opacity=".72" fontSize="4.5" fontWeight="900" textAnchor="middle">
          <text x={project(-188)} y={project(-154)}>웨스트</text><text x={project(-204)} y={project(72)}>마켓</text><text x={project(188)} y={project(-94)}>스카이</text><text x={project(52)} y={project(224)}>하버</text><text x={project(0)} y={project(52)}>센트럴</text>
        </g>
        <g textAnchor="middle" fontSize="5.5"><text x={project(-135)} y={project(-145) + 2}>🏔️</text><text x={project(-162)} y={project(72) + 2}>🛠️</text><text x={project(145)} y={project(-88) + 2}>🌨️</text><text x={project(-20)} y={project(208) + 2}>⚓</text></g>
        {Object.values(DESTINATIONS).map((place) => <text key={place.id} x={project(place.landmarkX)} y={project(place.landmarkZ) + 3} textAnchor="middle" fontSize="7">{place.icon}</text>)}
        {routePoints ? <polyline points={routePoints} fill="none" stroke="#fff" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round" opacity=".9" /> : null}
        {routePoints ? <polyline points={routePoints} fill="none" stroke={hud.target?.color || "#ff595e"} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 2" /> : null}
        <circle cx={tx} cy={ty} r="9" fill={hud.target?.color || "#ff595e"} className="target-pulse" />
        <text x={tx} y={ty + 4} textAnchor="middle" fontSize="11">{hud.target?.icon || "📦"}</text>
        <g transform={`translate(${px} ${py}) rotate(${(-hud.heading * 180) / Math.PI})`}><path d="M0 -8 L6 7 L0 4 L-6 7 Z" fill="#ffffff" stroke="#1d3557" strokeWidth="2" /></g>
      </svg>
    </aside>
  );
}

function Controls({ runtimeRef }) {
  const bind = (key) => ({
    onPointerDown: (event) => {
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* 합성 이벤트 등 캡처 불가 시에도 입력은 처리 */ }
      runtimeRef.current?.setInput({ [key]: true });
    },
    onPointerUp: () => runtimeRef.current?.setInput({ [key]: false }),
    onPointerCancel: () => runtimeRef.current?.setInput({ [key]: false }),
    onLostPointerCapture: () => runtimeRef.current?.setInput({ [key]: false })
  });
  return (
    <div className="touch-controls">
      <div className="steer-controls"><button type="button" {...bind("left")} aria-label="왼쪽">◀</button><button type="button" {...bind("right")} aria-label="오른쪽">▶</button></div>
      <div className="pedal-controls"><button className="brake" type="button" {...bind("brake")}>BRAKE</button><button className="boost" type="button" {...bind("boost")}>⚡ TURBO</button><button className="accel" type="button" {...bind("accel")}>GO!</button></div>
    </div>
  );
}

function DeliveryQuiz({ quiz, result, onAnswer }) {
  return (
    <div className="quiz-overlay">
      <div className="delivered-scene">
        <span className="delivery-success">DELIVERY!</span>
        <span className="place-icon">{quiz.destination.icon}</span>
        <strong>{quiz.destination.name}</strong>
        <small>{quiz.package} 도착</small>
      </div>
      <section className="quiz-panel">
        <span className="quiz-label">{quiz.label}</span>
        <h2>마지막 배송 암호!</h2>
        <div className="idiom-card"><strong>{quiz.hanja}</strong>{quiz.korean ? <span>{quiz.korean}</span> : null}</div>
        <p>{quiz.question}</p>
        <div className="quiz-options">
          {quiz.options.map((option, index) => {
            const stateClass = result ? (index === result.correctIndex ? "correct" : "muted") : "";
            return <button className={stateClass} type="button" key={option} onClick={() => onAnswer(index)}><b>{index + 1}</b><span>{option}</span></button>;
          })}
        </div>
        {result ? <div className={result.correct ? "answer-feedback correct" : "answer-feedback wrong"}>{result.correct ? "정답! 보너스 10초 획득!" : `정답: ${result.meaning}`}</div> : <small className="quiz-help">숫자 1~4 또는 버튼을 눌러요</small>}
      </section>
    </div>
  );
}

function ResultScreen({ result, onRetry, onGarage }) {
  const complete = result.reason === "complete";
  const rating = complete ? (result.stars >= 6 ? 3 : result.stars >= 3 ? 2 : 1) : 1;
  return (
    <div className="result-overlay">
      <section className="result-card">
        <span className="result-badge">{complete ? "MISSION COMPLETE" : "TIME OVER"}</span>
        <div className="result-mascot">{complete ? "🚚💨" : "⏰"}</div>
        <h2>{complete ? "도심 배송 성공!" : "도심 루트를 다시 공략해 봐요!"}</h2>
        <div className="result-stars">{[1, 2, 3].map((star) => <span key={star} className={star <= rating ? "earned" : ""}>★</span>)}</div>
        <div className="result-grid">
          <div><small>최종 점수 (=XP)</small><strong>{Math.round(result.score).toLocaleString()}</strong></div>
          <div><small>배달 완료</small><strong>{result.deliveries}/{result.total}</strong></div>
          <div><small>획득 골드</small><strong>+{(result.totalGold ?? result.reward ?? 0).toLocaleString()}G</strong></div>
        </div>
        {result.bonus ? (
          <div className={result.bonus.achieved ? "answer-feedback correct" : "answer-feedback wrong"}>
            {result.bonus.icon} {result.bonus.label} — {result.bonus.achieved ? `성공! +${result.bonus.reward}G` : "다음에 다시 도전!"}
          </div>
        ) : null}
        {result.rivalRace ? (
          <div className={result.rivalRace.playerWon ? "answer-feedback correct" : "answer-feedback wrong"}>
            {result.rivalRace.playerWon ? "🏁 라이벌 격파! 풀 보상 획득!" : "🏁 라이벌에게 패배… 보상 25%만 지급"}
          </div>
        ) : null}
        <div className="result-actions"><button type="button" onClick={onGarage}>차고로</button><button className="primary" type="button" onClick={onRetry}>다시 도전</button></div>
      </section>
    </div>
  );
}
