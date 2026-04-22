(function () {
  var cfg = window.__BUILDBET_SUPABASE || {};
  var SUPABASE_URL = String(cfg.url || "").replace(/\/+$/, "");
  var SUPABASE_ANON_KEY = cfg.anonKey || "";

  var totalEl = document.getElementById("waitlist-total");
  var alltimeEl = document.getElementById("waitlist-alltime");
  var updatedEl = document.getElementById("waitlist-updated");
  var trafficTotalEl = document.getElementById("traffic-total");
  var trafficUpdatedEl = document.getElementById("traffic-updated");
  var trafficLogEl = document.getElementById("traffic-log");
  var trafficEmptyEl = document.getElementById("traffic-empty");
  var granularityEl = document.getElementById("chart-granularity");
  var trafficGranularityEl = document.getElementById("traffic-chart-granularity");
  var errEl = document.getElementById("dash-error");
  var signupCanvas = document.getElementById("waitlist-chart");
  var trafficCanvas = document.getElementById("traffic-chart");
  var rangeBtns = document.querySelectorAll(".dash-range-btn");

  var signupChartInstance = null;
  var trafficChartInstance = null;
  var selectedDays = 7;

  function showError(message) {
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
  }

  function clearError() {
    if (errEl) {
      errEl.textContent = "";
      errEl.hidden = true;
    }
  }

  function syncRangeButtons() {
    rangeBtns.forEach(function (btn) {
      var d = parseInt(btn.getAttribute("data-days"), 10);
      btn.classList.toggle("is-active", d === selectedDays);
    });
  }

  /** Short label for the x-axis (many points). */
  function formatHourAxis(t) {
    if (!t) return "";
    var d = new Date(t);
    if (isNaN(d.getTime())) return String(t);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      timeZone: "UTC",
    });
  }

  /** Full timestamp for tooltips. */
  function formatHourTooltip(t) {
    if (!t) return "";
    var d = new Date(t);
    if (isNaN(d.getTime())) return String(t);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  }

  function cumulativeSeries(series) {
    var labels = [];
    var values = [];
    var rawTimes = [];
    var run = 0;
    if (!Array.isArray(series)) {
      return { labels: labels, values: values, rawTimes: rawTimes };
    }
    series.forEach(function (row) {
      if (!row || row.t == null) return;
      run += Number(row.count) || 0;
      rawTimes.push(row.t);
      labels.push(formatHourAxis(row.t));
      values.push(run);
    });
    return { labels: labels, values: values, rawTimes: rawTimes };
  }

  function hourlySeries(series) {
    var labels = [];
    var values = [];
    var rawTimes = [];
    if (!Array.isArray(series)) {
      return { labels: labels, values: values, rawTimes: rawTimes };
    }
    series.forEach(function (row) {
      if (!row || row.t == null) return;
      rawTimes.push(row.t);
      labels.push(formatHourAxis(row.t));
      values.push(Number(row.count) || 0);
    });
    return { labels: labels, values: values, rawTimes: rawTimes };
  }

  function granularityLabel(days) {
    var slice = days === 1 ? "last 24 hours" : "last " + days + " days";
    return "UTC · hourly buckets · " + slice;
  }

  function formatTrafficTimestamp(t) {
    if (!t) return "";
    var d = new Date(t);
    if (isNaN(d.getTime())) return String(t);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  }

  function renderTrafficLog(times) {
    if (!trafficLogEl) return;
    trafficLogEl.innerHTML = "";
    var list = Array.isArray(times) ? times : [];
    if (!list.length) {
      if (trafficEmptyEl) trafficEmptyEl.hidden = false;
      return;
    }
    if (trafficEmptyEl) trafficEmptyEl.hidden = true;
    list.slice(0, 18).forEach(function (t) {
      var li = document.createElement("li");
      li.textContent = formatTrafficTimestamp(t);
      trafficLogEl.appendChild(li);
    });
  }

  function destroyChart(kind) {
    if (kind === "signup" && signupChartInstance) {
      signupChartInstance.destroy();
      signupChartInstance = null;
      return;
    }
    if (kind === "traffic" && trafficChartInstance) {
      trafficChartInstance.destroy();
      trafficChartInstance = null;
    }
  }

  function renderChart(kind, labels, values, rawTimes, selectedDays) {
    if (typeof Chart === "undefined") return;
    var canvas = kind === "traffic" ? trafficCanvas : signupCanvas;
    if (!canvas) return;
    destroyChart(kind);

    var prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var grid = "rgba(255,255,255,0.06)";
    var tick = "rgba(255,255,255,0.35)";
    var maxTicks = selectedDays <= 1 ? 12 : selectedDays <= 3 ? 10 : 8;
    var isTraffic = kind === "traffic";

    var nextChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: isTraffic ? "Views" : "Cumulative",
            data: values,
            borderColor: isTraffic ? "rgba(120, 240, 181, 0.95)" : "rgba(166, 182, 255, 0.95)",
            backgroundColor: isTraffic ? "rgba(73, 198, 147, 0.2)" : "rgba(124, 140, 255, 0.2)",
            borderWidth: 2,
            fill: true,
            tension: 0.25,
            pointRadius: labels.length <= 1 ? 4 : 0,
            pointHoverRadius: 5,
            pointBackgroundColor: isTraffic ? "#dcffef" : "#dfe5ff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: prefersReduced ? false : { duration: 900, easing: "easeOutQuart" },
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(20,20,20,0.92)",
            borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            titleColor: "#f4f4f4",
            bodyColor: "#a8a8a8",
            padding: 12,
            displayColors: false,
            callbacks: {
              title: function (items) {
                var i = items[0].dataIndex;
                if (rawTimes && rawTimes[i] != null) {
                  return formatHourTooltip(rawTimes[i]);
                }
                return items[0].label || "";
              },
              label: function (item) {
                return (isTraffic ? "Views: " : "Cumulative signups: ") + item.formattedValue;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: grid, drawBorder: false },
            ticks: {
              color: tick,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: maxTicks,
              font: { size: 11 },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: grid, drawBorder: false },
            ticks: {
              color: tick,
              font: { size: 11 },
              precision: 0,
            },
          },
        },
      },
    });
    if (isTraffic) {
      trafficChartInstance = nextChart;
    } else {
      signupChartInstance = nextChart;
    }
  }

  function fetchStats() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      showError(
        "Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env, run npm run env:gen, and refresh."
      );
      if (totalEl) totalEl.textContent = "—";
      if (alltimeEl) {
        alltimeEl.textContent = "";
        alltimeEl.hidden = true;
      }
      renderChart("signup", [], [], [], selectedDays);
      renderChart("traffic", [], [], [], selectedDays);
      return Promise.resolve();
    }

    clearError();
    if (totalEl) totalEl.textContent = "…";

    return fetch(SUPABASE_URL + "/rest/v1/rpc/waitlist_dashboard_stats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ p_days: selectedDays }),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) {
            var hint =
              res.status === 404
                ? " The stats function may be missing — run the dashboard section of supabase-waitlist.sql in the Supabase SQL editor."
                : "";
            throw new Error(
              (text && text.slice(0, 200)) || "Request failed (" + res.status + ")." + hint
            );
          }
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error("Unexpected response from server.");
          }
        });
      })
      .then(function (data) {
        var total = data && data.total != null ? Number(data.total) : 0;
        var allTime =
          data && data.all_time_total != null ? Number(data.all_time_total) : null;
        var trafficTotal =
          data && data.traffic_total != null ? Number(data.traffic_total) : 0;
        var trafficTimes = (data && data.traffic_times) || [];
        var trafficSeries = (data && data.traffic_series) || [];
        var series = (data && data.series) || [];

        if (totalEl) {
          totalEl.textContent = String(total);
        }
        if (alltimeEl) {
          if (allTime != null && !isNaN(allTime)) {
            alltimeEl.textContent = "All-time list size · " + allTime;
            alltimeEl.hidden = false;
          } else {
            alltimeEl.textContent = "";
            alltimeEl.hidden = true;
          }
        }
        if (updatedEl) {
          updatedEl.textContent = "Updated " + new Date().toLocaleString();
          updatedEl.hidden = false;
        }
        if (trafficTotalEl) {
          trafficTotalEl.textContent = String(trafficTotal);
        }
        if (trafficUpdatedEl) {
          trafficUpdatedEl.textContent = "Updated " + new Date().toLocaleString();
          trafficUpdatedEl.hidden = false;
        }
        renderTrafficLog(trafficTimes);
        if (granularityEl) {
          granularityEl.textContent = granularityLabel(selectedDays);
        }
        if (trafficGranularityEl) {
          trafficGranularityEl.textContent = granularityLabel(selectedDays);
        }

        var cum = cumulativeSeries(series);
        var trafficHourly = hourlySeries(trafficSeries);
        renderChart("signup", cum.labels, cum.values, cum.rawTimes, selectedDays);
        renderChart("traffic", trafficHourly.labels, trafficHourly.values, trafficHourly.rawTimes, selectedDays);
      })
      .catch(function (err) {
        showError(err && err.message ? err.message : "Could not load waitlist stats.");
        if (totalEl) totalEl.textContent = "—";
        if (alltimeEl) {
          alltimeEl.textContent = "";
          alltimeEl.hidden = true;
        }
        if (trafficTotalEl) {
          trafficTotalEl.textContent = "—";
        }
        if (trafficUpdatedEl) {
          trafficUpdatedEl.textContent = "";
          trafficUpdatedEl.hidden = true;
        }
        renderTrafficLog([]);
        renderChart("signup", [], [], [], selectedDays);
        renderChart("traffic", [], [], [], selectedDays);
      });
  }

  rangeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var d = parseInt(btn.getAttribute("data-days"), 10);
      if (isNaN(d) || d === selectedDays) return;
      selectedDays = d;
      syncRangeButtons();
      fetchStats();
    });
  });

  syncRangeButtons();
  fetchStats();
})();
