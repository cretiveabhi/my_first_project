
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "1mb" }));

const configured = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

const db = configured
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

function requireDb(req, res, next) {
  if (!db) {
    return res.status(503).json({
      error: "Database not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to server environment."
    });
  }
  next();
}

function fail(res, error) {
  console.error(error);
  return res.status(400).json({
    error: error.message || "Request failed"
  });
}

async function rows(table, query = (q) => q) {
  const { data, error } = await query(db.from(table).select("*"));
  if (error) throw error;
  return data || [];
}

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Krishi Sarathi API",
    databaseConfigured: configured,
    message: configured
      ? "API and Supabase configuration detected"
      : "API running; configure Supabase to persist data"
  });
});

// DASHBOARD
app.get("/api/dashboard", requireDb, async (req, res) => {
  try {
    const [farmers, centres, bookings, notifications] = await Promise.all([
      rows("farmers", q => q.eq("is_active", true)),
      rows("centres", q => q.eq("is_active", true)),
      rows("bookings"),
      rows("notifications")
    ]);

    res.json({
      farmers: farmers.length,
      centres: centres.length,
      bookings: bookings.length,
      quintals: bookings.reduce(
        (n, b) => n + Number(b.quantity_quintals || 0),
        0
      ),
      unreadNotifications: notifications.filter(n => !n.is_read).length
    });
  } catch (e) {
    fail(res, e);
  }
});

// FARMERS
app.get("/api/farmers", requireDb, async (req, res) => {
  try {
    let q = db
      .from("farmers")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.query.active === "true") {
      q = q.eq("is_active", true);
    }

    if (req.query.search) {
      q = q.or(
        `name.ilike.%${req.query.search}%,mobile.ilike.%${req.query.search}%,farmer_code.ilike.%${req.query.search}%`
      );
    }

    const { data, error } = await q;
    if (error) throw error;

    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

app.post("/api/farmers", requireDb, async (req, res) => {
  try {
    const {
      name,
      mobile,
      village,
      district,
      farmer_code,
      preferred_language = "Hindi",
      latitude,
      longitude
    } = req.body;

    if (!name?.trim() || !mobile?.trim() || !village?.trim()) {
      return res.status(422).json({
        error: "Name, mobile and village are required."
      });
    }

    const { data, error } = await db
      .from("farmers")
      .insert({
        name: name.trim(),
        mobile: mobile.trim(),
        village: village.trim(),
        district: district || "Indore",
        farmer_code: farmer_code || `KS-${Date.now().toString().slice(-6)}`,
        preferred_language,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (e) {
    fail(res, e);
  }
});

app.patch("/api/farmers/:id", requireDb, async (req, res) => {
  try {
    const allowed = [
      "name",
      "mobile",
      "village",
      "district",
      "preferred_language",
      "latitude",
      "longitude",
      "is_active"
    ];

    const payload = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    const { data, error } = await db
      .from("farmers")
      .update(payload)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

app.delete("/api/farmers/:id", requireDb, async (req, res) => {
  try {
    // Soft delete preserves booking and audit history.
    const { data, error } = await db
      .from("farmers")
      .update({ is_active: false })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, farmer: data });
  } catch (e) {
    fail(res, e);
  }
});

// PROCUREMENT CENTRES
app.get("/api/centres", requireDb, async (req, res) => {
  try {
    const { data, error } = await db
      .from("centres")
      .select("*")
      .order("name");

    if (error) throw error;

    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

app.post("/api/centres", requireDb, async (req, res) => {
  try {
    const {
      name,
      address,
      village,
      latitude,
      longitude,
      capacity_quintals = 500,
      available_quintals = 250
    } = req.body;

    if (!name || !address) {
      return res.status(422).json({
        error: "Centre name and address are required."
      });
    }

    const { data, error } = await db
      .from("centres")
      .insert({
        name,
        address,
        village,
        latitude,
        longitude,
        capacity_quintals,
        available_quintals,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (e) {
    fail(res, e);
  }
});

// BOOKINGS
// IMPORTANT: Centres are fetched through split_allocations,
// because bookings do not have a direct foreign key to centres.
app.get("/api/bookings", requireDb, async (req, res) => {
  try {
    let q = db
      .from("bookings")
      .select(`
        *,
        farmers(name, farmer_code, mobile),
        split_allocations(
          id,
          centre_id,
          quantity_quintals,
          centres(name, address)
        )
      `)
      .order("created_at", { ascending: false });

    if (req.query.farmer_id) {
      q = q.eq("farmer_id", req.query.farmer_id);
    }

    const { data, error } = await q;

    if (error) throw error;

    res.json(data || []);
  } catch (e) {
    fail(res, e);
  }
});


app.post("/api/bookings", requireDb, async (req, res) => {
  try {
    const {
      farmer_id,
      crop,
      booking_date,
      quantity_quintals,
      allocations = []
    } = req.body;

    if (
      !farmer_id ||
      !crop ||
      !booking_date ||
      Number(quantity_quintals) <= 0 ||
      !Array.isArray(allocations) ||
      allocations.length === 0
    ) {
      return res.status(422).json({
        error: "Farmer, crop, date, quantity and at least one centre allocation are required."
      });
    }

    const formattedAllocations = allocations.map(a => ({
      centre_id: a.centre_id,
      quantity_quintals: Number(a.quantity_quintals)
    }));

    const { data, error } = await db.rpc(
      "create_booking_with_allocations",
      {
        p_farmer_id: farmer_id,
        p_crop: crop,
        p_booking_date: booking_date,
        p_quantity_quintals: Number(quantity_quintals),
        p_allocations: formattedAllocations
      }
    );

    if (error) throw error;

    res.status(201).json(data);

  } catch (e) {
    fail(res, e);
  }
});

app.patch("/api/bookings/:id/status", requireDb, async (req, res) => {
  try {
    const { status, note = "" } = req.body;

    const allowed = [
      "Booking confirmed",
      "Waiting for procurement",
      "Farmer arrived",
      "Crop weighing",
      "Quality verification",
      "Procurement completed",
      "Payment initiated",
      "Payment completed",
      "Weather review required",
      "Reallocation confirmed"
    ];

    if (!allowed.includes(status)) {
      return res.status(422).json({
        error: "Invalid tracking status."
      });
    }

    // 1. Update booking status
    const { data, error } = await db
      .from("bookings")
      .update({ status })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;

    // 2. Create tracking event
    const { error: trackingError } = await db
      .from("tracking_events")
      .insert({
        booking_id: data.id,
        status,
        note
      });

    if (trackingError) throw trackingError;

    // 3. Automatically create farmer notification
    const { error: notificationError } = await db
      .from("notifications")
      .insert({
        farmer_id: data.farmer_id,
        booking_id: data.id,
        type: "booking",
        title: "Procurement status updated",
        message: `Your ${data.crop} procurement booking for ${data.quantity_quintals} quintals is now ${status}.${note ? " Note: " + note : ""}`,
        severity: "normal",
        is_read: false
      });

    if (notificationError) throw notificationError;

    // 4. Return updated booking
    res.json(data);

  } catch (e) {
    fail(res, e);
  }
});

// NOTIFICATIONS
app.get("/api/notifications", requireDb, async (req, res) => {
  try {
    let q = db
      .from("notifications")
      .select("*, farmers(name, farmer_code)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (req.query.farmer_id) {
      q = q.eq("farmer_id", req.query.farmer_id);
    }

    const { data, error } = await q;

    if (error) throw error;

    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

app.patch("/api/notifications/:id/read", requireDb, async (req, res) => {
  try {
    const { data, error } = await db
      .from("notifications")
      .update({ is_read: true })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

// WEATHER
app.get("/api/weather", requireDb, async (req, res) => {
  try {
    const { data, error } = await db
      .from("weather_records")
      .select("*, centres(name)")
      .order("forecast_for", { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

// LIVE WEATHER — OPEN-METEO
app.post("/api/weather/refresh-live", requireDb, async (req, res) => {
  try {
    const { data: centres, error: centreError } = await db
      .from("centres")
      .select("id, name, latitude, longitude")
      .eq("is_active", true);

    if (centreError) throw centreError;

    const validCentres = (centres || []).filter(
      c => c.latitude != null && c.longitude != null
    );

    if (!validCentres.length) {
      return res.status(400).json({
        error: "No active centres have valid coordinates."
      });
    }

    const weatherRows = await Promise.all(
      validCentres.map(async centre => {
        const params = new URLSearchParams({
          latitude: String(centre.latitude),
          longitude: String(centre.longitude),
          hourly: "precipitation_probability,precipitation",
          current: "temperature_2m,relative_humidity_2m,weather_code",
          forecast_days: "2",
          timezone: "UTC"
        });

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params}`
        );

        if (!response.ok) {
          throw new Error(
            `Weather API failed for ${centre.name}: HTTP ${response.status}`
          );
        }

        const forecast = await response.json();

        if (!forecast.current || !forecast.hourly) {
          throw new Error(`Incomplete weather data for ${centre.name}`);
        }

        const now = new Date(forecast.current.time);
        const times = forecast.hourly.time || [];

        const startIndex = times.findIndex(
          time => new Date(time) >= now
        );

        const index = startIndex >= 0 ? startIndex : 0;
        const next24 = (forecast.hourly.precipitation_probability || [])
          .slice(index, index + 24);

        const rain24 = (forecast.hourly.precipitation || [])
          .slice(index, index + 24);

        const probability = next24.length
          ? Math.max(...next24.map(Number))
          : 0;

        const rainfall = rain24.reduce(
          (total, value) => total + Number(value || 0),
          0
        );

        const code = forecast.current.weather_code;

        const conditions = {
          0: "Clear sky",
          1: "Mainly clear",
          2: "Partly cloudy",
          3: "Overcast",
          45: "Fog",
          48: "Depositing rime fog",
          51: "Light drizzle",
          53: "Moderate drizzle",
          55: "Dense drizzle",
          61: "Slight rain",
          63: "Moderate rain",
          65: "Heavy rain",
          71: "Slight snowfall",
          73: "Moderate snowfall",
          75: "Heavy snowfall",
          80: "Rain showers",
          81: "Moderate rain showers",
          82: "Violent rain showers",
          95: "Thunderstorm",
          96: "Thunderstorm with hail",
          99: "Severe thunderstorm with hail"
        };

        let severity = "normal";

        if (probability >= 70 || rainfall >= 10) {
          severity = "high";
        } else if (probability >= 40 || rainfall >= 2.5) {
          severity = "moderate";
        }

        return {
          centre_id: centre.id,
          forecast_for: new Date().toISOString(),
          condition: conditions[code] || "Unknown conditions",
          temperature_c: forecast.current.temperature_2m,
          humidity_percent: forecast.current.relative_humidity_2m,
          rainfall_probability: probability,
          rainfall_mm: Number(rainfall.toFixed(2)),
          severity,
          source: "Open-Meteo live"
        };
      })
    );

    // Remove previous weather records before saving fresh data
const { error: deleteError } = await db
  .from("weather_records")
  .delete()
  .not("forecast_for", "is", null);

if (deleteError) throw deleteError;

// Save the latest live weather records
const { data: saved, error: saveError } = await db
  .from("weather_records")
  .insert(weatherRows)
  .select();

if (saveError) throw saveError;

    if (saveError) throw saveError;

    res.json({
      success: true,
      source: "Open-Meteo",
      centresUpdated: saved.length,
      weather: saved,
      message: `Live weather fetched for ${saved.length} procurement centres.`
    });

  } catch (e) {
    fail(res, e);
  }
});


// WEATHER SIMULATION
app.post("/api/weather/simulate-rain", requireDb, async (req, res) => {
  try {
    const { centre_id } = req.body;

    if (!centre_id) {
      return res.status(422).json({
        error: "Select a procurement centre."
      });
    }

    const { data: centre, error: ce } = await db
      .from("centres")
      .select("*")
      .eq("id", centre_id)
      .single();

    if (ce) throw ce;

    const tomorrow = new Date(Date.now() + 86400000).toISOString();

    const { data: weather, error: we } = await db
      .from("weather_records")
      .insert({
        centre_id,
        forecast_for: tomorrow,
        condition: "Heavy rainfall",
        temperature_c: 23,
        humidity_percent: 91,
        rainfall_probability: 95,
        rainfall_mm: 42,
        severity: "high",
        source: "Evaluator simulation"
      })
      .select()
      .single();

    if (we) throw we;

    const { data: splits, error: se } = await db
      .from("split_allocations")
      .select("booking_id, bookings(id, farmer_id, booking_date, status)")
      .eq("centre_id", centre_id);

    if (se) throw se;

    const affected = (splits || []).filter(
      s =>
        s.bookings &&
        new Date(s.bookings.booking_date) >=
          new Date(new Date().toDateString())
    );

    const unique = [
      ...new Map(
        affected.map(s => [s.bookings.id, s.bookings])
      ).values()
    ];

    if (unique.length) {
      const notices = unique.map(b => ({
        farmer_id: b.farmer_id,
        booking_id: b.id,
        type: "weather",
        title: "Heavy rainfall alert — " + centre.name,
        message: `Heavy rainfall is simulated for ${centre.name} tomorrow. Review alternative procurement centres for your booking.`,
        severity: "high",
        is_read: false
      }));

      const { error: ne } = await db
        .from("notifications")
        .insert(notices);

      if (ne) throw ne;

      for (const b of unique) {
        await db
          .from("bookings")
          .update({ status: "Weather review required" })
          .eq("id", b.id);

        await db.from("tracking_events").insert({
          booking_id: b.id,
          status: "Weather review required",
          note: "Heavy rainfall simulation triggered an alert."
        });
      }
    }

    res.json({
      weather,
      affectedBookings: unique.length,
      message: `Rain alert created. ${unique.length} booking(s) checked.`
    });
  } catch (e) {
    fail(res, e);
  }
});

// TRACKING
app.get("/api/tracking/:bookingId", requireDb, async (req, res) => {
  try {
    const { data, error } = await db
      .from("tracking_events")
      .select("*")
      .eq("booking_id", req.params.bookingId)
      .order("created_at");

    if (error) throw error;

    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

// START SERVER
app.listen(port, () => {
  console.log(
    `Krishi Sarathi API listening on ${port}; Supabase configured: ${configured}`
  );
});
