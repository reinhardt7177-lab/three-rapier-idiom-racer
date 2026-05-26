import { useEffect, useRef, useState } from "react";
import { createThreeRapierRacingRuntime } from "./create-three-rapier-runtime.js";

const defaultHud = {
  speed: 0,
  score: 0,
  time: 80,
  boost: 0,
  rank: "3/3",
  lapTime: "0:00.00",
  bestLap: "--:--",
  drift: 0,
  minimap: null,
  raceStatus: "idle",
  lights: 0,
  winner: ""
};

export default function CarRacingPage() {
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const gameOverRef = useRef(null);
  const quizPromptRef = useRef(null);
  const messageTimerRef = useRef(null);
  const joystickRef = useRef(null);

  const [hud, setHud] = useState(defaultHud);
  const [message, setMessage] = useState("READY");
  const [gameOver, setGameOver] = useState(null);
  const [quizPrompt, setQuizPrompt] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [stick, setStick] = useState({ active: false, x: 0, y: 0 });

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    quizPromptRef.current = quizPrompt;
  }, [quizPrompt]);

  useEffect(() => {
    if (!mountRef.current) return undefined;

    try {
      runtimeRef.current = createThreeRapierRacingRuntime({
        mount: mountRef.current,
        onHudUpdate: setHud,
        onMessage: (text) => {
          setMessage(text);
          if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
          messageTimerRef.current = window.setTimeout(() => setMessage(""), 650);
        },
        onGameOver: (payload) => {
          gameOverRef.current = payload;
          setGameOver(payload);
          quizPromptRef.current = null;
          setQuizPrompt(null);
          setMessage(payload.reason);
        },
        onQuizPrompt: (payload) => {
          quizPromptRef.current = payload;
          setQuizPrompt(payload);
        }
      });
      setErrorText("");
    } catch (error) {
      console.error(error);
      setErrorText("3D runtime init failed");
    }

    const onKeyDown = (event) => {
      if (!runtimeRef.current) return;
      if (quizPromptRef.current && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const result = runtimeRef.current.answerQuiz?.(Number(event.key) - 1);
        if (result?.answered) {
          quizPromptRef.current = null;
          setQuizPrompt(null);
        }
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        runtimeRef.current.startRace?.();
        runtimeRef.current.setInput({ steerRight: true });
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        runtimeRef.current.startRace?.();
        runtimeRef.current.setInput({ steerLeft: true });
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        runtimeRef.current.startRace?.();
        runtimeRef.current.setInput({ accel: true });
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        runtimeRef.current.startRace?.();
        runtimeRef.current.setInput({ brake: true });
      }
      if (event.key === "Shift" || event.key.toLowerCase() === "x") {
        event.preventDefault();
        runtimeRef.current.startRace?.();
        runtimeRef.current.setInput({ boost: true });
      }
      if (event.key === "Enter" && gameOverRef.current) {
        event.preventDefault();
        runtimeRef.current.restart();
        gameOverRef.current = null;
        setGameOver(null);
      } else if (event.key === "Enter") {
        event.preventDefault();
        runtimeRef.current.startRace?.();
      }
    };

    const onKeyUp = (event) => {
      if (!runtimeRef.current) return;
      if (event.key === "ArrowLeft") runtimeRef.current.setInput({ steerRight: false });
      if (event.key === "ArrowRight") runtimeRef.current.setInput({ steerLeft: false });
      if (event.key === "ArrowUp") runtimeRef.current.setInput({ accel: false });
      if (event.key === "ArrowDown") runtimeRef.current.setInput({ brake: false });
      if (event.key === "Shift" || event.key.toLowerCase() === "x") {
        runtimeRef.current.setInput({ boost: false });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
  }, []);

  const boostRatio = Math.min(1, hud.boost / 100);

  const updateJoystick = (event) => {
    runtimeRef.current?.startRace?.();
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    const maxDistance = rect.width * 0.34;
    const rawX = event.clientX - (rect.left + rect.width / 2);
    const rawY = event.clientY - (rect.top + rect.height / 2);
    const x = clampValue(rawX / maxDistance, -1, 1);
    const y = clampValue(rawY / maxDistance, -1, 1);

    setStick({ active: true, x, y });
    runtimeRef.current?.setInput({ steerAxis: -x });
  };

  const releaseJoystick = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setStick({ active: false, x: 0, y: 0 });
    runtimeRef.current?.setInput({ steerAxis: 0 });
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.frame}>
          <div ref={mountRef} style={styles.mount} />
          <div style={styles.vignette} />
          <div style={styles.scanline} />

          <header style={styles.hud}>
            <HudCard label="Speed" value={`${hud.speed}`} />
            <HudCard label="Score" value={`${hud.score}`} />
            <HudCard label="Lap" value={`${hud.time}`} />
            <HudCard label="Rank" value={hud.rank || "3/3"} />
            <HudCard label="Lap Time" value={hud.lapTime || "0:00.00"} />
            <div style={styles.boostCard}>
              <span style={styles.hudLabel}>Boost</span>
              <div style={styles.boostTrack}>
                <div style={{ ...styles.boostFill, transform: `scaleX(${boostRatio.toFixed(3)})` }} />
              </div>
            </div>
          </header>
          <MiniMap data={hud.minimap} />

          {message ? <div style={styles.message}>{message}</div> : null}
          <TrafficLights phase={hud.lights} />
          {errorText ? <div style={styles.error}>{errorText}</div> : null}
          {quizPrompt ? (
            <QuizCard
              quiz={quizPrompt}
              onAnswer={(index) => {
                const result = runtimeRef.current?.answerQuiz?.(index);
                if (result?.answered) {
                  quizPromptRef.current = null;
                  setQuizPrompt(null);
                }
              }}
            />
          ) : null}

          {!gameOver && hud.raceStatus === "idle" ? (
            <div style={styles.startPanel}>
              <p style={styles.startEyebrow}>2 LAPS · 3 RACERS</p>
              <button
                type="button"
                style={styles.startButton}
                onClick={() => runtimeRef.current?.startRace?.()}
              >
                GAME START
              </button>
              <p style={styles.startHint}>초록불이 켜지면 출발</p>
            </div>
          ) : null}

          {gameOver ? (
            <div style={styles.overlay}>
              <div style={styles.modal}>
                <p style={styles.modalTop}>{gameOver.title || "RACE FINISH"}</p>
                <h2 style={styles.modalTitle}>{gameOver.reason}</h2>
                <p style={styles.modalBody}>Score {gameOver.score}</p>
                <button
                  type="button"
                  style={styles.restartButton}
                  onClick={() => {
                    runtimeRef.current?.restart();
                    gameOverRef.current = null;
                    quizPromptRef.current = null;
                    setGameOver(null);
                    setQuizPrompt(null);
                  }}
                >
                  Restart
                </button>
              </div>
            </div>
          ) : null}

          <div style={styles.tabletControls}>
            <div style={styles.joystickCluster}>
              <div
                ref={joystickRef}
                style={styles.joystickBase}
                role="button"
                tabIndex={0}
                aria-label="Steering joystick"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateJoystick(event);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) updateJoystick(event);
                }}
                onPointerUp={releaseJoystick}
                onPointerCancel={releaseJoystick}
                onLostPointerCapture={() => {
                  setStick({ active: false, x: 0, y: 0 });
                  runtimeRef.current?.setInput({ steerAxis: 0 });
                }}
              >
                <div style={styles.joystickRing} />
                <div
                  style={{
                    ...styles.joystickKnob,
                    transform: `translate(-50%, -50%) translate(${stick.x * 38}px, ${stick.y * 38}px) scale(${stick.active ? 1.05 : 1})`
                  }}
                />
              </div>
              <span style={styles.controlHint}>STEER</span>
            </div>

            <div style={styles.pedalCluster}>
            <button
              type="button"
              style={{ ...styles.controlButton, ...styles.brakeButton }}
              onPointerDown={() => {
                runtimeRef.current?.startRace?.();
                runtimeRef.current?.setInput({ brake: true });
              }}
              onPointerUp={() => runtimeRef.current?.setInput({ brake: false })}
              onPointerLeave={() => runtimeRef.current?.setInput({ brake: false })}
              onPointerCancel={() => runtimeRef.current?.setInput({ brake: false })}
            >
              BRAKE
            </button>
            <button
              type="button"
              style={{ ...styles.controlButton, ...styles.boostButton }}
              onPointerDown={() => {
                runtimeRef.current?.startRace?.();
                runtimeRef.current?.setInput({ boost: true });
              }}
              onPointerUp={() => runtimeRef.current?.setInput({ boost: false })}
              onPointerLeave={() => runtimeRef.current?.setInput({ boost: false })}
              onPointerCancel={() => runtimeRef.current?.setInput({ boost: false })}
            >
              BOOST
            </button>
            <button
              type="button"
              style={{ ...styles.controlButton, ...styles.accelButton }}
              onPointerDown={() => {
                runtimeRef.current?.startRace?.();
                runtimeRef.current?.setInput({ accel: true });
              }}
              onPointerUp={() => runtimeRef.current?.setInput({ accel: false })}
              onPointerLeave={() => runtimeRef.current?.setInput({ accel: false })}
              onPointerCancel={() => runtimeRef.current?.setInput({ accel: false })}
            >
              ACCEL
            </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function HudCard({ label, value }) {
  return (
    <div style={styles.hudCard}>
      <span style={styles.hudLabel}>{label}</span>
      <span style={styles.hudValue}>{value}</span>
    </div>
  );
}

function QuizCard({ quiz, onAnswer }) {
  return (
    <div style={styles.quizOverlay}>
      <div style={styles.quizCard}>
        <div style={styles.quizTop}>
          <span style={styles.quizBadge}>{quiz.checkpointLabel}</span>
          <span style={styles.quizHint}>1-4 키 또는 터치로 선택</span>
        </div>
        <p style={styles.quizQuestion}>{quiz.question}</p>
        <div style={styles.quizIdiom}>
          <strong style={styles.quizHanja}>{quiz.hanja}</strong>
          <span style={styles.quizKorean}>{quiz.korean}</span>
        </div>
        <div style={styles.quizOptions}>
          {quiz.options.map((option, index) => (
            <button
              key={`${quiz.id}-${option}`}
              type="button"
              style={styles.quizOption}
              onClick={() => onAnswer(index)}
            >
              <span style={styles.quizOptionIndex}>{index + 1}</span>
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrafficLights({ phase }) {
  const currentPhase = Number(phase) || 0;
  const isGreen = currentPhase >= 4;
  return (
    <div style={styles.trafficLight} aria-label="Race start lights">
      {[1, 2, 3].map((light) => (
        <span
          key={light}
          style={{
            ...styles.lightDot,
            ...(currentPhase >= light && !isGreen ? styles.redLightOn : styles.lightOff)
          }}
        />
      ))}
      <span style={{ ...styles.lightDot, ...(isGreen ? styles.greenLightOn : styles.lightOff) }} />
    </div>
  );
}

function MiniMap({ data }) {
  const convert = (point) => {
    if (!point) return { x: 50, y: 50 };
    return {
      x: clampValue(50 + (point.x / 260) * 45, 5, 95),
      y: clampValue(50 + (point.z / 95) * 42, 8, 92)
    };
  };
  const player = convert(data?.player);
  const rivals = data?.rivals || [];
  return (
    <div style={styles.miniMap}>
      <svg viewBox="0 0 100 100" style={styles.miniMapSvg} aria-label="Mini map">
        <rect x="2" y="2" width="96" height="96" rx="14" fill="rgba(5,14,29,0.62)" stroke="rgba(179,221,255,0.8)" strokeWidth="2" />
        <path d="M18 50 C18 18, 82 18, 82 50 C82 82, 18 82, 18 50Z" fill="none" stroke="rgba(226,241,255,0.76)" strokeWidth="4" />
        <path d="M27 50 C27 28, 73 28, 73 50 C73 72, 27 72, 27 50Z" fill="none" stroke="rgba(83,255,137,0.34)" strokeWidth="2" strokeDasharray="3 3" />
        {rivals.map((rival, index) => {
          const p = convert(rival);
          return <circle key={`${p.x}-${p.y}-${index}`} cx={p.x} cy={p.y} r="3.1" fill={index === 0 ? "#4aa3ff" : "#ff9c32"} stroke="#081323" strokeWidth="1" />;
        })}
        <polygon points={`${player.x},${player.y - 5} ${player.x - 4},${player.y + 4} ${player.x + 4},${player.y + 4}`} fill="#ff2f35" stroke="#fff4a8" strokeWidth="1" />
      </svg>
      <span style={styles.miniMapLabel}>MAP</span>
    </div>
  );
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const styles = {
  page: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    margin: 0,
    padding: "10px",
    overflow: "hidden",
    background: "radial-gradient(circle at 50% -20%, #4ca9ff 0%, #18498f 34%, #09152a 72%, #040811 100%)",
    fontFamily: "\"Trebuchet MS\", \"Segoe UI\", sans-serif"
  },
  shell: {
    width: "min(98vw, 1360px, 170dvh)"
  },
  frame: {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    overflow: "hidden",
    borderRadius: "20px",
    border: "4px solid #9bc9ff",
    background: "#091727",
    boxShadow: "0 20px 58px rgba(0,0,0,0.42), inset 0 0 0 4px rgba(22,40,70,0.88)"
  },
  mount: { position: "absolute", inset: 0, touchAction: "none" },
  vignette: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: "radial-gradient(circle at 50% 38%, transparent 36%, rgba(0,0,0,0.25) 100%)"
  },
  scanline: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: "repeating-linear-gradient(180deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 4px)",
    mixBlendMode: "multiply"
  },
  hud: {
    position: "absolute",
    top: 10,
    left: 12,
    width: "min(840px, calc(100% - 178px))",
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(88px, 1fr))",
    gap: "7px",
    pointerEvents: "none"
  },
  hudCard: {
    display: "grid",
    gap: "2px",
    padding: "7px 9px",
    borderRadius: "10px",
    background: "rgba(8, 20, 42, 0.68)",
    border: "1px solid rgba(157, 206, 255, 0.72)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)"
  },
  hudLabel: {
    color: "#9fc0e5",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.7px"
  },
  hudValue: {
    color: "#f2f8ff",
    fontSize: "18px",
    fontWeight: 800,
    lineHeight: 1
  },
  boostCard: {
    padding: "8px 10px",
    borderRadius: "10px",
    background: "rgba(8, 20, 42, 0.68)",
    border: "1px solid rgba(157, 206, 255, 0.72)"
  },
  boostTrack: {
    marginTop: "6px",
    height: "7px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "rgba(255,255,255,0.14)"
  },
  boostFill: {
    height: "100%",
    transformOrigin: "left center",
    background: "linear-gradient(90deg, #8dff9f 0%, #ffe27d 58%, #ff8b63 100%)"
  },
  miniMap: {
    position: "absolute",
    right: 16,
    top: 16,
    width: "132px",
    height: "132px",
    borderRadius: "18px",
    padding: "7px",
    background: "linear-gradient(180deg, rgba(6,18,36,0.72), rgba(7,13,26,0.58))",
    border: "1px solid rgba(166,214,255,0.7)",
    boxShadow: "0 12px 26px rgba(0,0,0,0.24)",
    pointerEvents: "none"
  },
  miniMapSvg: {
    width: "100%",
    height: "100%",
    display: "block"
  },
  miniMapLabel: {
    position: "absolute",
    left: "12px",
    bottom: "9px",
    color: "#bfe5ff",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "1px"
  },
  message: {
    position: "absolute",
    left: "50%",
    top: "14%",
    transform: "translateX(-50%)",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "rgba(12, 24, 43, 0.75)",
    border: "1px solid rgba(201, 228, 255, 0.56)",
    color: "#ffe58a",
    fontSize: "18px",
    fontWeight: 900,
    letterSpacing: "0.5px"
  },
  trafficLight: {
    position: "absolute",
    left: "50%",
    top: "64px",
    transform: "translateX(-50%)",
    display: "flex",
    gap: "8px",
    padding: "8px 11px",
    borderRadius: "999px",
    background: "linear-gradient(180deg, rgba(9,17,31,0.86), rgba(4,8,16,0.82))",
    border: "1px solid rgba(220,239,255,0.46)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
    pointerEvents: "none"
  },
  lightDot: {
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    display: "block",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.12)"
  },
  lightOff: {
    background: "rgba(255,255,255,0.13)"
  },
  redLightOn: {
    background: "radial-gradient(circle at 35% 30%, #ffd0ca 0%, #ff3228 38%, #76100f 100%)",
    boxShadow: "0 0 18px rgba(255,52,39,0.72)"
  },
  greenLightOn: {
    background: "radial-gradient(circle at 35% 30%, #e6ffd7 0%, #59ff62 36%, #0b7734 100%)",
    boxShadow: "0 0 22px rgba(78,255,95,0.78)"
  },
  startPanel: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    display: "grid",
    justifyItems: "center",
    gap: "8px",
    padding: "18px 20px",
    borderRadius: "18px",
    background: "linear-gradient(180deg, rgba(9,22,43,0.84), rgba(6,13,25,0.82))",
    border: "1px solid rgba(183,221,255,0.68)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.34)"
  },
  startEyebrow: {
    margin: 0,
    color: "#a9d5ff",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "1.1px"
  },
  startButton: {
    border: 0,
    borderRadius: "999px",
    padding: "12px 24px",
    background: "linear-gradient(180deg, #fff09b 0%, #ffc947 100%)",
    color: "#172a42",
    fontSize: "19px",
    fontWeight: 1000,
    letterSpacing: "0.8px",
    boxShadow: "0 12px 24px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.62)",
    cursor: "pointer"
  },
  startHint: {
    margin: 0,
    color: "#e8f5ff",
    fontSize: "12px",
    fontWeight: 700
  },
  error: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 94,
    padding: "10px 12px",
    borderRadius: "12px",
    background: "rgba(92, 16, 24, 0.88)",
    color: "#ffe6e6",
    fontWeight: 700
  },
  quizOverlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "linear-gradient(180deg, rgba(2,8,18,0.36), rgba(2,8,18,0.64))",
    zIndex: 8
  },
  quizCard: {
    width: "min(92%, 620px)",
    padding: "20px",
    borderRadius: "22px",
    background: "linear-gradient(180deg, rgba(7,24,47,0.96), rgba(5,14,30,0.94))",
    border: "2px solid rgba(170, 222, 255, 0.86)",
    boxShadow: "0 24px 58px rgba(0,0,0,0.44), inset 0 0 0 1px rgba(255,255,255,0.08)"
  },
  quizTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px"
  },
  quizBadge: {
    padding: "5px 10px",
    borderRadius: "999px",
    background: "linear-gradient(180deg, #ffe78a, #ffbf3d)",
    color: "#152642",
    fontSize: "12px",
    fontWeight: 1000,
    letterSpacing: "0.8px"
  },
  quizHint: {
    color: "#a9d6ff",
    fontSize: "12px",
    fontWeight: 800
  },
  quizQuestion: {
    margin: "14px 0 0",
    color: "#e8f7ff",
    fontSize: "16px",
    fontWeight: 900,
    textAlign: "center"
  },
  quizIdiom: {
    marginTop: "10px",
    display: "grid",
    placeItems: "center",
    gap: "4px",
    padding: "14px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(190,229,255,0.36)"
  },
  quizHanja: {
    color: "#fff0a4",
    fontSize: "34px",
    letterSpacing: "3px",
    lineHeight: 1
  },
  quizKorean: {
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: 1000
  },
  quizOptions: {
    marginTop: "14px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px"
  },
  quizOption: {
    minHeight: "58px",
    border: "1px solid rgba(190,225,255,0.68)",
    borderRadius: "14px",
    padding: "10px 12px",
    background: "linear-gradient(180deg, rgba(30,74,118,0.96), rgba(14,35,70,0.96))",
    color: "#f7fbff",
    fontSize: "14px",
    fontWeight: 800,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(0,0,0,0.22)"
  },
  quizOptionIndex: {
    display: "inline-grid",
    placeItems: "center",
    width: "24px",
    height: "24px",
    marginRight: "8px",
    borderRadius: "999px",
    background: "#ffe37d",
    color: "#17243b",
    fontWeight: 1000
  },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(2, 8, 18, 0.54)"
  },
  modal: {
    width: "min(90%, 340px)",
    padding: "20px",
    borderRadius: "16px",
    background: "linear-gradient(180deg, rgba(8,20,40,0.94), rgba(9,28,56,0.94))",
    border: "1px solid rgba(165, 212, 255, 0.72)"
  },
  modalTop: { margin: 0, color: "#9fd6ff", fontSize: "12px", letterSpacing: "1.2px" },
  modalTitle: { margin: "8px 0 0", color: "#f5f9ff", fontSize: "24px" },
  modalBody: { margin: "12px 0 0", color: "#d7eaff", fontSize: "15px" },
  restartButton: {
    marginTop: "16px",
    border: 0,
    borderRadius: "999px",
    background: "linear-gradient(180deg, #ffe88e, #ffc95b)",
    color: "#1f2d45",
    fontWeight: 800,
    fontSize: "16px",
    padding: "10px 16px",
    cursor: "pointer"
  },
  tabletControls: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 18,
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    pointerEvents: "none",
    userSelect: "none"
  },
  joystickCluster: {
    display: "grid",
    placeItems: "center",
    gap: "6px",
    pointerEvents: "auto"
  },
  joystickBase: {
    position: "relative",
    width: "118px",
    height: "118px",
    borderRadius: "999px",
    border: "2px solid rgba(185, 224, 255, 0.82)",
    background: "radial-gradient(circle at 50% 50%, rgba(69, 139, 205, 0.42) 0%, rgba(9, 23, 45, 0.72) 62%, rgba(4, 10, 22, 0.84) 100%)",
    boxShadow: "0 12px 26px rgba(0,0,0,0.34), inset 0 0 0 5px rgba(255,255,255,0.05)",
    touchAction: "none",
    cursor: "grab"
  },
  joystickRing: {
    position: "absolute",
    inset: "30px",
    borderRadius: "999px",
    border: "1px dashed rgba(220, 241, 255, 0.48)"
  },
  joystickKnob: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "56px",
    height: "56px",
    borderRadius: "999px",
    background: "linear-gradient(180deg, #f6fbff 0%, #80b8f4 45%, #24517f 100%)",
    border: "2px solid rgba(245, 252, 255, 0.92)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.34), inset 0 -5px 0 rgba(10,24,42,0.22)",
    transition: "transform 70ms ease-out"
  },
  controlHint: {
    minWidth: "92px",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "rgba(7, 17, 33, 0.62)",
    border: "1px solid rgba(165, 213, 255, 0.45)",
    color: "#edf7ff",
    fontSize: "11px",
    fontWeight: 900,
    textAlign: "center",
    letterSpacing: "0.7px"
  },
  pedalCluster: {
    display: "grid",
    gridTemplateColumns: "94px 94px",
    gridTemplateRows: "50px 70px",
    gap: "9px",
    pointerEvents: "auto"
  },
  controlButton: {
    borderRadius: "14px",
    border: "1px solid rgba(211, 236, 255, 0.76)",
    color: "#f7fbff",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.4px",
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.16)",
    touchAction: "none"
  },
  brakeButton: {
    background: "linear-gradient(180deg, rgba(86, 29, 39, 0.88), rgba(40, 14, 24, 0.86))"
  },
  boostButton: {
    background: "linear-gradient(180deg, rgba(37, 86, 133, 0.88), rgba(17, 38, 76, 0.86))"
  },
  accelButton: {
    gridColumn: "1 / span 2",
    background: "linear-gradient(180deg, rgba(31, 128, 83, 0.94), rgba(11, 67, 50, 0.9))",
    fontSize: "15px"
  }
};


