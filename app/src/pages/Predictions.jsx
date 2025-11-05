import { useEffect, useState } from "react";
import { getPredictions } from "../lib/api";

export default function Predictions(){
    const [rows, setRows] = useState([]);
    const [err, setErr] = useState("");

    useEffect(() => {
        getPredictions().then(setRows).catch(e => setErr(e.message));
    }, []);

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
        <h1 className="text-2xl font-bold mb-4">Fantasy Foresight</h1>
        {err && <div className="text-red-400">{err}</div>}
        <table className="w-full text-left text-sm">
            <thead className="text-slate-300">
            <tr>
                <th className="py-2">Player</th>
                <th>Team</th>
                <th>Pos</th>
                <th>Price</th>
                <th>Pred Pts</th>
                <th>GW</th>
            </tr>
            </thead>
            <tbody>
            {rows.map(r => (
                <tr key={r.player_id} className="border-t border-slate-700">
                <td className="py-2">{r.player_name}</td>
                <td>{r.team}</td>
                <td>{r.position}</td>
                <td>{r.price}</td>
                <td className="font-semibold">{r.predicted_points}</td>
                <td>{r.gameweek}</td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    );
}