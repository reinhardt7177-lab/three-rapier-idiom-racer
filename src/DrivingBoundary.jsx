import React, { Component } from 'react';

export function DrivingLoading({ onGarage }) {
  return <main className="drive-transition" aria-label="주행 준비">
    <section className="transition-card" role="status">
      <span className="eyebrow">COASTLINE / HORIZON CLUB</span>
      <h1>해안으로 나갈 준비</h1>
      <p>주행 화면과 물리엔진을 불러오고 있습니다.<br />연결 상태에 따라 첫 출발은 조금 걸릴 수 있습니다.</p>
      <div className="loading-track" aria-hidden="true"><i /></div>
      <button onClick={onGarage}>차고로 돌아가기</button>
    </section>
  </main>;
}

// React's lazy import rejection happens outside createDriving's runtime catch.
// Keep the garage and in-memory campaign available without a forced reload.
export class DrivingBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="drive-transition" aria-label="주행 연결 오류">
      <section className="transition-card" role="alert">
        <span className="eyebrow">COASTLINE / CONNECTION</span>
        <h1>출발 준비가 중단됐습니다</h1>
        <p>주행 파일을 불러오지 못했거나 화면에 오류가 발생했습니다. 네트워크 연결을 확인해 주세요.</p>
        <p>차고로 돌아가 기존 기록을 확인할 수 있습니다. 문제가 계속되면 저장 상태를 확인한 뒤 페이지를 다시 열어 주세요. 새로고침하면 저장되지 않은 기록은 사라질 수 있습니다.</p>
        <button autoFocus onClick={this.props.onGarage}>차고로 돌아가기</button>
      </section>
    </main>;
  }
}
