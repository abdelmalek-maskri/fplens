import { useEffect, useState } from "react";
import { getBestXI } from "../lib/api";

export default function BestXI(){
    const [data, setData] = useState(null);

    useEffect(() => {
        getBestXI().then(setData).catch(e => setErr(e.message));
    }, []);

    if(!data){
        return <p className="text-center text-gray-400">Loading...</p>
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Best XI - Gameweek {data.gameweek}</h1>
            <p>Total Predicted Points: {data.total_predicted_points.toFixed(1)}</p>
            <table className="w-full mt-4 border border-gra-700">
                <thead><tr><th>Name</th><th>Team</th><th>Points</th></tr></thead>
                <tbody>
                    {data.players.map(p => (
                        <tr key={p.player_id}>
                            <td>{p.player_name}</td>
                            <td>{p.team}</td>
                            <td>{p.predicted_points}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}