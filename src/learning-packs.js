import { idiomQuizData } from "./idiom-quiz-data.js";

// 학습팩: 게이트/보스 퀴즈에 꽂아 쓰는 교체형 문제 모듈.
// makeQuestion이 공통 인터페이스 { packId, key, headline, prompt, choices, correctIndex, explain }를 돌려준다.
export const LEARNING_PACKS = [
  { id: "idiom", name: "사자성어", icon: "📜", color: "#ffb703", tagline: "한자 암호 해독" },
  { id: "spelling", name: "맞춤법", icon: "✏️", color: "#00b4d8", tagline: "되/돼 정면승부" },
  { id: "math", name: "스피드 암산", icon: "➗", color: "#70e000", tagline: "달리면서 계산" }
];

export function getPack(packId) {
  return LEARNING_PACKS.find((pack) => pack.id === packId) || LEARNING_PACKS[0];
}

// 맞춤법 팩: 보기 2개 — 2차선 게이트와 정확히 맞물린다.
const SPELLING_DATA = [
  { id: "sp1", sentence: "이제 가도 __?", choices: ["돼", "되"], correct: 0, explain: "'되어'로 풀 수 있으면 '돼'" },
  { id: "sp2", sentence: "그러면 안 __지!", choices: ["되", "돼"], correct: 1, explain: "'안 되어'가 줄어 '안 돼'" },
  { id: "sp3", sentence: "숙제를 아직 __ 했어", choices: ["안", "않"], correct: 0, explain: "뒤 말을 꾸미면 '안'" },
  { id: "sp4", sentence: "그 일은 하지 __았다", choices: ["않", "안"], correct: 0, explain: "'-지 않다'는 '않'" },
  { id: "sp5", sentence: "감기가 다 __았다", choices: ["나", "낳"], correct: 0, explain: "병이 회복되면 '낫다→나았다'" },
  { id: "sp6", sentence: "우리 개가 새끼를 __았다", choices: ["낳", "났"], correct: 0, explain: "출산은 '낳다'" },
  { id: "sp7", sentence: "__지 모르게 설렌다", choices: ["왠", "웬"], correct: 0, explain: "'왜인지'의 준말 '왠지'뿐" },
  { id: "sp8", sentence: "__ 떡이야?", choices: ["웬", "왠"], correct: 0, explain: "'어찌 된'은 '웬'" },
  { id: "sp9", sentence: "오늘은 __ 기분이 좋다", choices: ["왠지", "웬지"], correct: 0, explain: "'웬지'는 없는 말" },
  { id: "sp10", sentence: "책상 __에 두었어", choices: ["위", "우"], correct: 0, explain: "장소는 '위'" },
  { id: "sp11", sentence: "금__ 도착할게", choices: ["방", "빵"], correct: 0, explain: "'금방'이 표준어" },
  { id: "sp12", sentence: "떡볶이를 __였다", choices: ["데", "대"], correct: 0, explain: "음식을 데우다" },
  { id: "sp13", sentence: "약속 시간을 __겼다", choices: ["어", "에"], correct: 0, explain: "'어기다'가 표준어" },
  { id: "sp14", sentence: "실력이 한층 __었다", choices: ["늘", "느"], correct: 0, explain: "'늘다→늘었다'" },
  { id: "sp15", sentence: "짐을 __에 실었다", choices: ["트럭", "츄럭"], correct: 0, explain: "외래어 표기는 '트럭'" },
  { id: "sp16", sentence: "우리 __ 다시 만나", choices: ["이따가", "있다가"], correct: 0, explain: "시간이 지난 뒤는 '이따가'" },
  { id: "sp17", sentence: "집에 __ 올게", choices: ["갔다", "같다"], correct: 0, explain: "다녀오다는 '갔다 오다'" },
  { id: "sp18", sentence: "키가 나보다 더 __", choices: ["크대", "크데"], correct: 0, explain: "남에게 들은 말 전달은 '-대'" },
  { id: "sp19", sentence: "어제 보니 정말 잘하__라", choices: ["더", "데"], correct: 0, explain: "직접 경험 회상은 '-더라'" },
  { id: "sp20", sentence: "실수를 __ 인정했다", choices: ["깨끗이", "깨끗히"], correct: 0, explain: "'-하다' 앞말 끝이 ㅅ이면 '-이'" },
  { id: "sp21", sentence: "__ 늦지 않게 와", choices: ["절대", "절데"], correct: 0, explain: "'절대'가 표준어" },
  { id: "sp22", sentence: "오랜만에 만난 친구가 __", choices: ["반가워", "방가워"], correct: 0, explain: "'반갑다'가 표준어" },
  { id: "sp23", sentence: "문제의 __을 찾아라", choices: ["원인", "웬인"], correct: 0, explain: "'원인(原因)'" },
  { id: "sp24", sentence: "일이 __대로 되지 않았다", choices: ["뜻", "듯"], correct: 0, explain: "'뜻대로'" },
  { id: "sp25", sentence: "비가 올 __하다", choices: ["듯", "뜻"], correct: 0, explain: "짐작은 '-을 듯하다'" },
  { id: "sp26", sentence: "설거지는 내가 __게", choices: ["할", "핣"], correct: 0, explain: "'할게'로 적는다" },
  { id: "sp27", sentence: "내일 꼭 연락__게", choices: ["할", "핡"], correct: 0, explain: "'-ㄹ게'는 [께]로 읽어도 '게'" },
  { id: "sp28", sentence: "찌개가 참 __", choices: ["맛있네", "마싰네"], correct: 0, explain: "'맛있다'" },
  { id: "sp29", sentence: "경기에서 지면 __", choices: ["어떡해", "어떻해"], correct: 0, explain: "'어떻게 해'의 준말은 '어떡해'" },
  { id: "sp30", sentence: "이 길이 __ 빠르다", choices: ["훨씬", "훨신"], correct: 0, explain: "'훨씬'이 표준어" }
];

function shuffleWith(rng, items) {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

function makeIdiomQuestion(rng, choiceCount, wantedKey) {
  const pool = idiomQuizData;
  const correct = (wantedKey && pool.find((item) => item.korean === wantedKey)) || pool[Math.floor(rng() * pool.length)];
  const wrongs = shuffleWith(rng, pool.filter((item) => item.korean !== correct.korean)).slice(0, choiceCount - 1);
  const choices = shuffleWith(rng, [
    { text: correct.meaning, correct: true },
    ...wrongs.map((item) => ({ text: item.meaning, correct: false }))
  ]);
  return {
    packId: "idiom",
    key: correct.korean,
    headline: `${correct.hanja} · ${correct.korean}`,
    prompt: "이 사자성어의 뜻은?",
    choices: choices.map((choice) => choice.text),
    correctIndex: choices.findIndex((choice) => choice.correct),
    explain: `${correct.korean}: ${correct.meaning}`
  };
}

function makeSpellingQuestion(rng, wantedKey) {
  const item = (wantedKey && SPELLING_DATA.find((entry) => entry.id === wantedKey)) || SPELLING_DATA[Math.floor(rng() * SPELLING_DATA.length)];
  const flip = rng() > 0.5;
  const choices = flip ? [item.choices[1], item.choices[0]] : [...item.choices];
  const correctIndex = choices.indexOf(item.choices[item.correct]);
  return {
    packId: "spelling",
    key: item.id,
    headline: item.sentence,
    prompt: "빈칸에 맞는 말은?",
    choices,
    correctIndex,
    explain: `${item.sentence.replace("__", `[${item.choices[item.correct]}]`)} — ${item.explain}`
  };
}

function makeMathQuestion(rng, level, choiceCount) {
  let a;
  let b;
  let answer;
  let expression;
  if (level <= 1) {
    a = 2 + Math.floor(rng() * 8);
    b = 2 + Math.floor(rng() * 8);
    answer = a * b;
    expression = `${a} × ${b}`;
  } else if (level === 2) {
    a = 11 + Math.floor(rng() * 78);
    b = 11 + Math.floor(rng() * 78);
    if (rng() > 0.5) {
      answer = a + b;
      expression = `${a} + ${b}`;
    } else {
      if (b > a) [a, b] = [b, a];
      answer = a - b;
      expression = `${a} − ${b}`;
    }
  } else {
    a = 12 + Math.floor(rng() * 13);
    b = 3 + Math.floor(rng() * 7);
    answer = a * b;
    expression = `${a} × ${b}`;
  }
  const distractors = new Set();
  while (distractors.size < choiceCount - 1) {
    const offsets = [1, 2, 10, -1, -2, -10, answer >= 20 ? Math.round(answer * 0.1) : 3];
    const wrong = answer + offsets[Math.floor(rng() * offsets.length)];
    if (wrong !== answer && wrong > 0) distractors.add(wrong);
  }
  const choices = shuffleWith(rng, [answer, ...distractors]);
  return {
    packId: "math",
    key: `${expression}`,
    headline: `${expression} = ?`,
    prompt: "달리면서 계산!",
    choices: choices.map(String),
    correctIndex: choices.indexOf(answer),
    explain: `${expression} = ${answer}`
  };
}

// wanted: [{ packId, key }] — 틀렸던 문제를 우선 재출제한다(수배 전단).
export function makeQuestion(packId, { choiceCount = 3, wanted = [], rng = Math.random, level = 1 } = {}) {
  const wantedKey = wanted.find((item) => item.packId === packId)?.key || null;
  if (packId === "spelling") return makeSpellingQuestion(rng, wantedKey);
  if (packId === "math") return makeMathQuestion(rng, level, Math.max(2, choiceCount));
  return makeIdiomQuestion(rng, Math.max(2, choiceCount), wantedKey);
}
