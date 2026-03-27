import { supabase } from "./supabaseClient";

const unwrap = async (promise) => {
  const { data, error } = await promise;
  if (error) {
    throw error;
  }
  return data;
};

export const dashboardApi = {
  async getStats() {
    const [assets, borrowedBoxes, openIncidents, okAudits, totalAudits] = await Promise.all([
      supabase.from("assets").select("*", { count: "exact", head: true }),
      supabase.from("boxes").select("*", { count: "exact", head: true }).eq("status", "borrowed"),
      supabase.from("incidents").select("*", { count: "exact", head: true }).in("status", ["open", "in_review", "in_maintenance"]),
      supabase.from("audits").select("*", { count: "exact", head: true }).eq("status", "functioning_normally"),
      supabase.from("audits").select("*", { count: "exact", head: true })
    ]);

    const errors = [assets.error, borrowedBoxes.error, openIncidents.error, okAudits.error, totalAudits.error].filter(Boolean);
    if (errors.length) {
      throw errors[0];
    }

    return {
      totalAssets: assets.count || 0,
      borrowedBoxes: borrowedBoxes.count || 0,
      openIncidents: openIncidents.count || 0,
      okRate: totalAudits.count ? Math.round(((okAudits.count || 0) / totalAudits.count) * 100) : 0
    };
  }
};

export const lookupApi = {
  assetTypes: () => unwrap(supabase.from("asset_types").select("*").order("name")),
  labs: () => unwrap(supabase.from("labs").select("*").order("name")),
  rooms: () => unwrap(supabase.from("rooms").select("*").order("name")),
  profiles: () => unwrap(supabase.from("profiles").select("id, full_name, email, role").order("full_name")),
  assets: () => unwrap(supabase.from("assets").select("id, tag_code, model, status, lab_id").order("tag_code")),
  boxes: () => unwrap(supabase.from("boxes").select("id, name, status").order("name"))
};

export const assetsApi = {
  list(search = "") {
    let query = supabase
      .from("assets")
      .select("*, asset_types(id, name), labs(id, name)")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`tag_code.ilike.%${search}%,serial_number.ilike.%${search}%,model.ilike.%${search}%,host_name.ilike.%${search}%,domain_name.ilike.%${search}%`);
    }

    return unwrap(query);
  },
  create(payload) {
    return unwrap(supabase.from("assets").insert(payload).select("id").single());
  },
  update(id, payload) {
    return unwrap(supabase.from("assets").update(payload).eq("id", id).select("id").single());
  }
};

export const boxesApi = {
  list(search = "") {
    let query = supabase
      .from("boxes")
      .select("*, labs(id, name, location), box_assets(asset_id, assets(id, tag_code, model))")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    return unwrap(query);
  },
  async create({ assetIds, ...payload }) {
    const box = await unwrap(supabase.from("boxes").insert(payload).select("id").single());
    if (assetIds.length) {
      await unwrap(supabase.from("box_assets").insert(assetIds.map((assetId) => ({ box_id: box.id, asset_id: assetId }))));
    }
    return box;
  },
  async update(id, { assetIds, ...payload }) {
    await unwrap(supabase.from("boxes").update(payload).eq("id", id));
    await unwrap(supabase.from("box_assets").delete().eq("box_id", id));
    if (assetIds.length) {
      await unwrap(supabase.from("box_assets").insert(assetIds.map((assetId) => ({ box_id: id, asset_id: assetId }))));
    }
    return { id };
  }
};

export const loansApi = {
  list(filters = {}) {
    const { search = "", dateFrom = "", dateTo = "", targetType = "" } = typeof filters === "string" ? { search: filters } : filters;
    let query = supabase
      .from("loans")
      .select("id, box_id, asset_id, lab_id, room_id, responsible_name, session_class, borrowed_at, expected_return_at, returned_at, status, notes")
      .order("borrowed_at", { ascending: false });

    if (search) {
      query = query.or(`session_class.ilike.%${search}%`);
    }

    if (dateFrom) {
      query = query.gte("borrowed_at", `${dateFrom}T00:00:00`);
    }

    if (dateTo) {
      query = query.lte("borrowed_at", `${dateTo}T23:59:59`);
    }

    if (targetType === "box") {
      query = query.not("box_id", "is", null);
    } else if (targetType === "asset") {
      query = query.not("asset_id", "is", null);
    } else if (targetType === "lab") {
      query = query.not("lab_id", "is", null);
    }

    return unwrap(query);
  },
  create(payload) {
    return unwrap(
      supabase.rpc("request_loan", {
        p_box_id: payload.box_id,
        p_responsible_name: payload.responsible_name,
        p_room_id: payload.room_id,
        p_session_class: payload.session_class,
        p_expected_return_at: payload.expected_return_at,
        p_notes: payload.notes
      })
    );
  },
  markReturned(id) {
    return unwrap(supabase.rpc("return_loan", { p_loan_id: id }));
  }
};

export const checklistsApi = {
  list() {
    return unwrap(
      supabase
        .from("professor_lab_checklists")
        .select("id, lab_id, responsible_name, session_class, reported_at, status, notes")
        .order("reported_at", { ascending: false })
        .limit(10)
    );
  },
  create(payload) {
    return unwrap(
      supabase.rpc("submit_public_checklist", {
        p_lab_id: payload.lab_id,
        p_responsible_name: payload.responsible_name,
        p_session_class: payload.session_class,
        p_status: payload.status,
        p_notes: payload.notes
      })
    );
  }
};

export const auditsApi = {
  findAssetById(assetId) {
    return unwrap(
      supabase
        .from("assets")
        .select("id, tag_code, qr_code_value, host_name, domain_name, model, status, labs(id, name)")
        .eq("id", assetId)
        .maybeSingle()
    );
  },
  findAssetByQrValue(qrCodeValue) {
    return unwrap(
      supabase
        .from("assets")
        .select("id, tag_code, qr_code_value, host_name, domain_name, model, status, labs(id, name)")
        .eq("qr_code_value", qrCodeValue)
        .maybeSingle()
    );
  },
  findAssetByTag(tagCode) {
    return unwrap(
      supabase
        .from("assets")
        .select("id, tag_code, qr_code_value, host_name, domain_name, model, status, labs(id, name)")
        .eq("tag_code", tagCode)
        .maybeSingle()
    );
  },
  findBoxById(boxId) {
    return unwrap(
      supabase
        .from("boxes")
        .select("id, name, qr_code_value, description, expected_asset_count, status")
        .eq("id", boxId)
        .maybeSingle()
    );
  },
  findBoxByQrValue(qrCodeValue) {
    return unwrap(
      supabase
        .from("boxes")
        .select("id, name, qr_code_value, description, expected_asset_count, status")
        .eq("qr_code_value", qrCodeValue)
        .maybeSingle()
    );
  },
  findLabById(labId) {
    return unwrap(
      supabase
        .from("labs")
        .select("id, name, qr_code_value, location")
        .eq("id", labId)
        .maybeSingle()
    );
  },
  findLabByQrValue(qrCodeValue) {
    return unwrap(
      supabase
        .from("labs")
        .select("id, name, qr_code_value, location")
        .eq("qr_code_value", qrCodeValue)
        .maybeSingle()
    );
  },
  create(payload) {
    return unwrap(supabase.from("audits").insert(payload).select("id").single());
  }
};

export const incidentsApi = {
  list(filters = {}) {
    const { search = "", dateFrom = "", dateTo = "" } = typeof filters === "string" ? { search: filters } : filters;
    let query = supabase
      .from("incidents")
      .select("*, assets(id, tag_code), labs(id, name), boxes(id, name), profiles(id, full_name)")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00`);
    }

    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59`);
    }

    return unwrap(query);
  },
  create(payload) {
    return unwrap(supabase.from("incidents").insert(payload).select("id").single());
  },
  createEvent(payload) {
    return unwrap(
      supabase.rpc("create_incident_event", {
        p_asset_id: payload.asset_id ?? null,
        p_lab_id: payload.lab_id ?? null,
        p_box_id: payload.box_id ?? null,
        p_reported_by: payload.reported_by ?? null,
        p_title: payload.title,
        p_description: payload.description ?? null,
        p_severity: payload.severity ?? "medium",
        p_source: payload.source ?? "manual",
        p_source_reference_id: payload.source_reference_id ?? null
      })
    );
  },
  update(id, payload) {
    return unwrap(supabase.from("incidents").update(payload).eq("id", id).select("id").single());
  }
};

export const reportsApi = {
  async assetsCsv() {
    return unwrap(
      supabase
        .from("assets")
        .select("id, tag_code, qr_code_value, model, serial_number, host_name, domain_name, status, labs(name), asset_types(name)")
        .order("tag_code")
    );
  },
  async boxesCsv() {
    return unwrap(
      supabase
        .from("boxes")
        .select("id, name, qr_code_value, description, expected_asset_count, status, box_assets(asset_id)")
        .order("name")
    );
  },
  async labsCsv() {
    return unwrap(
      supabase
        .from("labs")
        .select("id, name, qr_code_value, location, assets(id)")
        .order("name")
    );
  },
  async usage(filters = {}) {
    return loansApi.list(filters);
  },
  async incidents(filters = {}) {
    return incidentsApi.list(filters);
  },
  async audits(filters = {}) {
    let query = supabase
      .from("audits")
      .select("id, asset_id, box_id, lab_id, audited_at, status, notes, assets(tag_code, model), boxes(name), labs(name)")
      .order("audited_at", { ascending: false });

    if (filters.dateFrom) {
      query = query.gte("audited_at", `${filters.dateFrom}T00:00:00`);
    }

    if (filters.dateTo) {
      query = query.lte("audited_at", `${filters.dateTo}T23:59:59`);
    }

    return unwrap(query);
  },
  async labChecklists(filters = {}) {
    let query = supabase
      .from("professor_lab_checklists")
      .select("id, lab_id, responsible_name, session_class, reported_at, status, notes, labs(name)")
      .order("reported_at", { ascending: false });

    if (filters.dateFrom) {
      query = query.gte("reported_at", `${filters.dateFrom}T00:00:00`);
    }

    if (filters.dateTo) {
      query = query.lte("reported_at", `${filters.dateTo}T23:59:59`);
    }

    return unwrap(query);
  },
  async boxChecklists(filters = {}) {
    let query = supabase
      .from("box_checklists")
      .select("id, box_id, responsible_name, session_class, stage, status, notes, reported_at, boxes(name)")
      .order("reported_at", { ascending: false });

    if (filters.dateFrom) {
      query = query.gte("reported_at", `${filters.dateFrom}T00:00:00`);
    }

    if (filters.dateTo) {
      query = query.lte("reported_at", `${filters.dateTo}T23:59:59`);
    }

    return unwrap(query);
  },
  async timeline(filters = {}) {
    const [usages, incidents, audits, labChecklists, boxChecklists] = await Promise.all([
      this.usage(filters),
      this.incidents(filters),
      this.audits(filters),
      this.labChecklists(filters),
      this.boxChecklists(filters)
    ]);

    return { usages, incidents, audits, labChecklists, boxChecklists };
  },
};

export const publicScanApi = {
  getAssetContext(assetId) {
    return unwrap(supabase.rpc("get_public_asset_context", { p_asset_id: assetId }).maybeSingle());
  },
  getBoxContext(boxId) {
    return unwrap(supabase.rpc("get_public_box_context", { p_box_id: boxId }).maybeSingle());
  },
  getLabContext(labId) {
    return unwrap(supabase.rpc("get_public_lab_context", { p_lab_id: labId }).maybeSingle());
  },
  requestLoanByBox(payload) {
    return unwrap(
      supabase.rpc("request_loan", {
        p_box_id: payload.box_id,
        p_responsible_name: payload.responsible_name,
        p_room_id: payload.room_id,
        p_session_class: payload.session_class,
        p_expected_return_at: payload.expected_return_at,
        p_notes: payload.notes
      })
    );
  },
  requestLoanByLab(payload) {
    return unwrap(
      supabase.rpc("request_loan_by_lab", {
        p_lab_id: payload.lab_id,
        p_responsible_name: payload.responsible_name,
        p_room_id: payload.room_id,
        p_session_class: payload.session_class,
        p_expected_return_at: payload.expected_return_at,
        p_notes: payload.notes
      })
    );
  },
  submitBoxChecklist(payload) {
    return unwrap(
      supabase.rpc("submit_public_box_checklist", {
        p_box_id: payload.box_id,
        p_loan_id: payload.loan_id,
        p_responsible_name: payload.responsible_name,
        p_session_class: payload.session_class,
        p_stage: payload.stage,
        p_status: payload.status,
        p_notes: payload.notes
      })
    );
  }
};

export const labsApi = {
  list(search = "") {
    let query = supabase
      .from("labs")
      .select("*, assets(id)")
      .order("name");

    if (search) {
      query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%`);
    }

    return unwrap(query);
  },
  async create({ assetIds = [], ...payload }) {
    const lab = await unwrap(supabase.from("labs").insert(payload).select("id").single());
    if (assetIds.length) {
      await unwrap(supabase.from("assets").update({ lab_id: lab.id }).in("id", assetIds));
    }
    return lab;
  },
  async update(id, { assetIds = [], ...payload }) {
    await unwrap(supabase.from("labs").update(payload).eq("id", id).select("id").single());
    await unwrap(supabase.from("assets").update({ lab_id: null }).eq("lab_id", id));
    if (assetIds.length) {
      await unwrap(supabase.from("assets").update({ lab_id: id }).in("id", assetIds));
    }
    return { id };
  }
};
