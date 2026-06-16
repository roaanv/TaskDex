/* app.jsx — TaskDex root: provider + shell layout. */
function Shell() {
  const { state } = useStore();
  const countFor = (b) => Object.values(state.cards).filter((c) => window.evalFilter(c, b.filter)).length;
  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: NEON.bg }}>
      <Sidebar countFor={countFor} />
      <Board />
    </div>
  );
}
function App() {
  const theme = useThemeState(); // owns pref/system state at the root → whole tree re-renders on change
  return React.createElement(ThemeCtx.Provider, { value: theme },
    React.createElement(TaskDexProvider, null, React.createElement(Shell)));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
