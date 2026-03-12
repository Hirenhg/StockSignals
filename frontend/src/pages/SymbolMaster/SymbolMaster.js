import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";

const SymbolMaster = () => {
  const [symbolData, setSymbolData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterExchange, setFilterExchange] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const itemsPerPage = 100;

  const filteredData = symbolData
    .filter((item) => {
      const matchesSearch =
        item.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesExchange =
        !filterExchange || item.exch_seg === filterExchange;
      return matchesSearch && matchesExchange;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";
      if (sortConfig.direction === "asc") {
        return aValue.toString().localeCompare(bValue.toString());
      }
      return bValue.toString().localeCompare(aValue.toString());
    });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const exchanges = [
    ...new Set(symbolData.map((item) => item.exch_seg)),
  ].filter(Boolean);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const fetchSymbolMaster = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/symbol-master");
      const data = await response.json();
      setSymbolData(data);
    } catch (error) {
      console.error("Error fetching symbol master:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSymbolMaster();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterExchange]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <div className="spinner-border" role="status"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Stock Signals Symbol Master</title>
      </Helmet>
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Symbol Master Data</h4>
          <div className="d-flex gap-2">
            <select
              className="form-select"
              value={filterExchange}
              onChange={(e) => setFilterExchange(e.target.value)}
              style={{ maxWidth: "150px" }}
            >
              <option value="">All Exchanges</option>
              {exchanges.map((exchange) => (
                <option key={exchange} value={exchange}>
                  {exchange}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="form-control"
              placeholder="Search symbols..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: "300px" }}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover" style={{ fontSize: "14px" }}>
            <thead className="table-dark">
              <tr>
                <th
                  onClick={() => handleSort("token")}
                  style={{ cursor: "pointer" }}
                >
                  Token{" "}
                  {sortConfig.key === "token" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("symbol")}
                  style={{ cursor: "pointer" }}
                >
                  Symbol{" "}
                  {sortConfig.key === "symbol" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("name")}
                  style={{ cursor: "pointer" }}
                >
                  Name{" "}
                  {sortConfig.key === "name" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("exch_seg")}
                  style={{ cursor: "pointer" }}
                >
                  Exchange{" "}
                  {sortConfig.key === "exch_seg" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("expiry")}
                  style={{ cursor: "pointer" }}
                >
                  Expiry{" "}
                  {sortConfig.key === "expiry" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th>Strike</th>
                <th>Lot Size</th>
                <th>Tick Size</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, index) => (
                <tr key={index}>
                  <td>{item.token}</td>
                  <td className="fw-bold">{item.symbol}</td>
                  <td>{item.name || "-"}</td>
                  <td>
                    <span
                      className={`badge ${item.exch_seg === "NSE" ? "bg-primary" : item.exch_seg === "NFO" ? "bg-success" : "bg-secondary"}`}
                    >
                      {item.exch_seg}
                    </span>
                  </td>
                  <td>{item.expiry || "-"}</td>
                  <td>{item.strike || "-"}</td>
                  <td>{item.lotsize || "-"}</td>
                  <td>{item.tick_size || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-3">
          <span className="text-muted">
            Showing {startIndex + 1}-
            {Math.min(startIndex + itemsPerPage, filteredData.length)} of{" "}
            {filteredData.length} symbols
          </span>
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li
                className={`page-item ${currentPage === 1 ? "disabled" : ""}`}
              >
                <button className="page-link" onClick={() => setCurrentPage(1)}>
                  First
                </button>
              </li>
              <li
                className={`page-item ${currentPage === 1 ? "disabled" : ""}`}
              >
                <button
                  className="page-link"
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Previous
                </button>
              </li>
              <li className="page-item active">
                <span className="page-link">
                  {currentPage} of {totalPages}
                </span>
              </li>
              <li
                className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}
              >
                <button
                  className="page-link"
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next
                </button>
              </li>
              <li
                className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}
              >
                <button
                  className="page-link"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  Last
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
};

export default SymbolMaster;
