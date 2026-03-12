import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async"

const Options = () => {
  const [optionsData, setOptionsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const filteredOptions = optionsData
    .filter((option) =>
      option.symbol?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";
      if (sortConfig.direction === "asc") {
        return aValue.toString().localeCompare(bValue.toString());
      }
      return bValue.toString().localeCompare(aValue.toString());
    });

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const fetchOptionsData = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/options/data");
      const data = await response.json();
      setOptionsData(data);
    } catch (error) {
      console.error("Error fetching options data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptionsData();
  }, []);

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
        <title>Stock Signals Options</title>
      </Helmet>
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Options Data</h4>
          <input
            type="text"
            className="form-control"
            placeholder="Search options..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: "300px" }}
          />
        </div>

        <div className="table-responsive">
          <table className="table table-hover" style={{ fontSize: "14px" }}>
            <thead className="table-dark">
              <tr>
                <th
                  onClick={() => handleSort("symbol")}
                  style={{ cursor: "pointer" }}
                >
                  Symbol{" "}
                  {sortConfig.key === "symbol" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("strikePrice")}
                  style={{ cursor: "pointer" }}
                >
                  Strike Price{" "}
                  {sortConfig.key === "strikePrice" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("optionType")}
                  style={{ cursor: "pointer" }}
                >
                  Option Type{" "}
                  {sortConfig.key === "optionType" &&
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
                <th>Underlying</th>
              </tr>
            </thead>
            <tbody>
              {filteredOptions.map((option, index) => (
                <tr key={index}>
                  <td className="fw-bold">{option.symbol}</td>
                  <td>₹{option.strikePrice}</td>
                  <td>
                    <span
                      className={`badge ${option.optionType === "CE" ? "bg-success" : "bg-danger"}`}
                    >
                      {option.optionType}
                    </span>
                  </td>
                  <td>{option.expiry}</td>
                  <td>{option.underlying}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-3 text-muted">
          <span>Total Options: {filteredOptions.length}</span>
        </div>
      </div>
    </>
  );
};

export default Options;
