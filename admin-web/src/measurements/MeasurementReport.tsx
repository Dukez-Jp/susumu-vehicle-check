import { activeReadings, type MeasurementSession } from "./model";
import {
  capturedTimeJa,
  correctionReasonJa,
  formatMm,
  getMeasurementReportIssues,
  measurementReference,
  metricLabelsJa,
  metricSourceRowJa,
  positionLabelJa,
  sourceLabelJa,
} from "./print";

export default function MeasurementReport({
  session,
}: {
  session: MeasurementSession;
}) {
  const active = activeReadings(session);
  const activeIds = new Set(active.map((reading) => reading.id));
  const ordinal = new Map(
    session.readings.map((reading, index) => [reading.id, index + 1]),
  );
  const issues = getMeasurementReportIssues(session);
  const simulation = session.readings.some(
    (reading) => reading.source === "simulator",
  );

  return (
    <article className="measurement-report" lang="ja">
      <header>
        <p>ススムグループ・測定記録</p>
        <h1>タイヤ・ブレーキ測定票</h1>
        <strong>見本・未確定{simulation ? "／模擬測定を含む" : ""}</strong>
        <p>測定値の記録です。点検の合否判定は行っていません。</p>
      </header>

      <dl className="measurement-report-meta">
        <div>
          <dt>自動車登録番号</dt>
          <dd>{session.registration}</dd>
        </div>
        <div>
          <dt>測定日</dt>
          <dd>{session.inspectionDate.replaceAll("-", "/")}</dd>
        </div>
        <div>
          <dt>走行距離</dt>
          <dd>{session.odometerKm.toLocaleString("ja-JP")} km</dd>
        </div>
        <div>
          <dt>測定担当者</dt>
          <dd>{session.operator}</dd>
        </div>
        <div>
          <dt>車軸数</dt>
          <dd>{session.axleCount}軸</dd>
        </div>
        <div>
          <dt>タイヤ構成</dt>
          <dd>
            {session.wheelLayout
              .map(
                (layout, index) =>
                  `第${index + 1}軸：${layout === "single" ? "単輪" : "複輪"}`,
              )
              .join("／")}
          </dd>
        </div>
        <div>
          <dt>帳票照合番号</dt>
          <dd>#{measurementReference(session)}</dd>
        </div>
      </dl>

      {issues.length ? (
        <p role="alert" className="measurement-report-issue">
          訂正理由の日本語確認が必要です。確認完了までこの測定票は印刷できません。
        </p>
      ) : null}

      <section>
        <h2>現在の測定値</h2>
        <p>
          測定済みの位置のみ記載しています。空欄や未測定の位置を「異常なし」と扱うものではありません。
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">測定項目</th>
              <th scope="col">位置</th>
              <th scope="col">測定値</th>
              <th scope="col">取得方法</th>
              <th scope="col">計測器</th>
              <th scope="col">記録時刻（日本時間）</th>
            </tr>
          </thead>
          <tbody>
            {active.map((reading) => (
              <tr key={reading.id} data-reading-id={reading.id}>
                <td>{metricLabelsJa[reading.metric]}</td>
                <td>{positionLabelJa(reading.position, reading.metric)}</td>
                <td>{formatMm(reading.valueMm)} mm</td>
                <td>{sourceLabelJa(reading)}</td>
                <td>
                  {reading.source === "simulator"
                    ? "模擬計測器"
                    : reading.deviceName || "記載なし"}
                </td>
                <td>{capturedTimeJa(reading.capturedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>記録履歴・訂正履歴</h2>
        <p>訂正前の値も保持しています。現在の測定値は「採用中」の記録です。</p>
        <table>
          <thead>
            <tr>
              <th scope="col">記録</th>
              <th scope="col">項目・位置</th>
              <th scope="col">値</th>
              <th scope="col">取得方法・計測器</th>
              <th scope="col">記録時刻（日本時間）</th>
              <th scope="col">状態</th>
              <th scope="col">理由・訂正元</th>
            </tr>
          </thead>
          <tbody>
            {session.readings.map((reading, index) => (
              <tr key={reading.id} data-history-reading-id={reading.id}>
                <td>{index + 1}</td>
                <td>
                  {metricLabelsJa[reading.metric]}
                  <br />
                  {positionLabelJa(reading.position, reading.metric)}
                </td>
                <td>{formatMm(reading.valueMm)} mm</td>
                <td>
                  {sourceLabelJa(reading)}
                  {reading.source === "simulator" || reading.deviceName ? (
                    <>
                      <br />
                      {reading.source === "simulator"
                        ? "模擬計測器"
                        : reading.deviceName}
                    </>
                  ) : null}
                </td>
                <td>{capturedTimeJa(reading.capturedAt)}</td>
                <td>{activeIds.has(reading.id) ? "採用中" : "訂正済"}</td>
                <td>
                  {correctionReasonJa(reading)}
                  {reading.supersedesId
                    ? `（記録${ordinal.get(reading.supersedesId) ?? "不明"}を訂正）`
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <footer>
        <p>記録識別子：{session.id}</p>
        <p>
          原本の点検項目：
          {[
            ...new Set(
              session.readings.map((reading) =>
                metricSourceRowJa(reading.metric),
              ),
            ),
          ].join("／") || "測定なし"}
          。測定値の保存だけでは点検結果を変更しません。
        </p>
      </footer>
    </article>
  );
}
