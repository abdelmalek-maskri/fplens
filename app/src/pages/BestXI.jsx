import { useEffect, useState } from "react";
import { getBestXI } from "../lib/api";
import Loading from "../components/Loading";
import ErrorBanner from "../components/ErrorBanner";
import { FaTrophy } from "react-icons/fa";

export default function BestXI() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBestXI()
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <FaTrophy /> Best XI {data ? `– Gameweek ${data.gameweek}` : ""}
      </h1>

      <ErrorBanner message={err} />
      {loading && <Loading />}

      {data && (
        <>
          <p className="mb-4">
            Total Predicted Points: <span className="font-semibold">{data.total_predicted_points.toFixed(1)}</span>
          </p>

          <table className="w-full text-left text-sm">
            <thead className="text-slate-300">
              <tr>
                <th className="py-2">Name</th>
                <th>Team</th>
                <th>Pos</th>
                <th>Price</th>
                <th>Pred Pts</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map(p => (
                <tr key={p.player_id} className="border-t border-slate-700">
                  <td className="py-2">{p.player_name}</td>
                  <td>{p.team}</td>
                  <td>{p.position}</td>
                  <td>{p.price}</td>
                  <td className="font-semibold">{p.predicted_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
