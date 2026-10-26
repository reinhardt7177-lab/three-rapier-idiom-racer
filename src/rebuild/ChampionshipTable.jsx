import React from 'react';
import {seriesTable} from './championship.js';
export function ChampionshipTable({series}){
 return <div className="series-table" aria-label="챔피언십 누적 순위"><div><strong>전남 챔피언십 · {series.rounds.length}/3</strong><span>점수 / 승</span></div>{seriesTable(series).map((r,i)=><div key={r.name} className={r.name==='YOU'?'you':''}><span>{i+1} · {r.name}</span><b>{r.points} / {r.wins}</b></div>)}</div>;
}
