import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { LoadState } from "../../components/common";
import { api } from "../../lib/api";
import type { IHallDetail, IHallListItem } from "../../lib/types";
import { useApi } from "../../lib/useApi";
import { HallLayoutEditor } from "./HallLayoutEditor";

/**
 * Admin hall list and the new-hall editor.
 *
 * @returns The halls admin page.
 */
export function HallsAdminPage() {
  const halls = useApi<IHallListItem[]>("/admin/halls");
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  return (
    <section className="page">
      <div className="page-head">
        <h1>Halls</h1>
        {!adding && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            Add hall
          </button>
        )}
      </div>

      {adding && (
        <HallLayoutEditor
          withName
          submitLabel="Create hall"
          onCancel={() => setAdding(false)}
          onSubmit={async (name, rows) => {
            const hall = await api<IHallDetail>("/admin/halls", { method: "POST", body: { name, rows } });
            navigate(`/admin/halls/${hall.id}`);
          }}
        />
      )}

      <LoadState loading={halls.loading && !halls.data} error={halls.error} />
      <ul className="hall-cards">
        {halls.data?.map((h) => (
          <li key={h.id}>
            <Link to={`/admin/halls/${h.id}`} className="card hall-card">
              <h2>{h.name}</h2>
              <p>
                <strong>{h.activeSeatCount}</strong> seats in service
                {h.activeSeatCount !== h.seatCount && <span className="muted"> ({h.seatCount - h.activeSeatCount} switched off)</span>}
              </p>
              <p className="muted small">
                {h.layoutRows} rows × {h.layoutCols} columns · {h.showtimeCount} showings
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
