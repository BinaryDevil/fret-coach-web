export default function Home() {
  const exercises = [
    ["01", "Finger independence", "Spider exercise", "8 min", "80 BPM"],
    ["02", "Clean transitions", "Chromatic climb", "10 min", "76 BPM"],
    ["03", "Picking control", "Alternate picking", "6 min", "92 BPM"],
  ];

  return (
    <main className="shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#home" aria-label="FretCoach home"><span className="brand-mark">F</span><span>FretCoach</span></a>
        <div className="nav-actions"><a href="#library">Practice library</a><a href="#progress">Progress</a><button className="avatar" aria-label="Open profile menu">JD</button></div>
      </nav>
      <section className="hero" id="home">
        <div><p className="eyebrow">TODAY&apos;S PRACTICE</p><h1>Make every note<br />land with intent.</h1><p className="hero-copy">Train timing, accuracy, and confidence with a practice coach that listens while you play.</p><div className="hero-actions"><button className="primary">Start a session <span>→</span></button><button className="text-button">How it works</button></div></div>
        <aside className="session-card" aria-label="Next practice session"><div className="session-topline"><span className="pulse" /> READY TO PLAY</div><p className="session-type">Technique builder</p><h2>Spider exercise</h2><div className="session-meta"><span>♩ 80 BPM</span><span>8 min</span><span>Level 2</span></div><div className="string-grid" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((string) => <div className="string-row" key={string}>{[0, 1, 2, 3, 4, 5, 6].map((fret) => <i key={fret} className={fret === string + 1 ? "active-note" : ""} />)}</div>)}</div></aside>
      </section>
      <section className="stats" id="progress" aria-label="Practice statistics"><div><span>7</span><p>day streak</p></div><div><span>92<span className="unit">%</span></span><p>average accuracy</p></div><div><span>3<span className="unit">h</span> 24<span className="unit">m</span></span><p>played this week</p></div><div className="coach-note"><b>Coach&apos;s note</b><p>Your timing is getting steadier. Try 84 BPM today.</p></div></section>
      <section className="library" id="library"><div className="section-heading"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Recommended for you</h2></div><a href="#library">View all →</a></div><div className="exercise-grid">{exercises.map(([number, label, title, time, bpm]) => <article className="exercise-card" key={number}><div className="card-number">{number}</div><p>{label}</p><h3>{title}</h3><footer><span>{time}</span><span>♩ {bpm}</span></footer></article>)}</div></section>
    </main>
  );
}
