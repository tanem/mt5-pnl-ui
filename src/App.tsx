import { Route, Routes } from "react-router-dom";
import { useApp } from "./store/app";
import LoadScreen from "./components/LoadScreen";
import Layout from "./components/Layout";
import Overview from "./views/Overview";
import CalendarView from "./views/CalendarView";
import Trades from "./views/Trades";
import Strategies from "./views/Strategies";

export default function App() {
  const snapshot = useApp((s) => s.snapshot);
  if (!snapshot) return <LoadScreen />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="trades" element={<Trades />} />
        <Route path="strategies" element={<Strategies />} />
      </Route>
    </Routes>
  );
}
