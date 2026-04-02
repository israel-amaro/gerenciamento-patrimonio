import { useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, FormField, Icon, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { loansApi, lookupApi } from "../lib/api";
import { buildLocationOptions, formatAssetIdentifier, formatDateTime } from "../lib/utils";

const createInitialForm = () => ({
  box_id: "",
  responsible_name: "",
  location_key: "",
  room_id: "",
  location_lab_id: "",
  room_name: "",
  session_class: "",
  expected_return_at: "",
  notes: "",
  selected_asset_ids: []
});

const statusMap = {
  active: ["Em andamento", "default"],
  returned: ["Devolvido", "success"],
  overdue: ["Atrasado", "warning"]
};

const targetTypeOptions = {
  all: "Tudo",
  box: "Carrinhos",
  asset: "Ativos",
  lab: "Laboratórios"
};

const LoansPage = () => {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [showAssetsSection, setShowAssetsSection] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loans = useAsyncData(() => loansApi.list({ search, dateFrom, dateTo, targetType }), [search, dateFrom, dateTo, targetType]);
  const lookups = useAsyncData(async () => {
    const [boxes, rooms, assets, labs] = await Promise.all([lookupApi.boxes(), lookupApi.rooms(), lookupApi.assets(), lookupApi.labs()]);
    return { boxes, rooms, assets, labs };
  }, []);

  const locationOptions = useMemo(
    () => buildLocationOptions({ rooms: lookups.data?.rooms || [], labs: lookups.data?.labs || [] }),
    [lookups.data]
  );

  const selectedBoxAssets = useMemo(() => {
    const box = lookups.data?.boxes.find((item) => item.id === form.box_id);
    return (box?.box_assets || []).map((item) => item.assets).filter(Boolean);
  }, [form.box_id, lookups.data]);

  const selectedAssetsCount = form.selected_asset_ids.length;

  const getBoxName = (boxId) => lookups.data?.boxes.find((box) => box.id === boxId)?.name || boxId;
  const getAssetName = (assetId) => {
    const asset = lookups.data?.assets.find((item) => item.id === assetId);
    return asset ? `${asset.tag_code} - ${asset.model}` : assetId;
  };
  const getLabName = (labId) => lookups.data?.labs.find((lab) => lab.id === labId)?.name || labId;
  const getRoomName = (roomId) => lookups.data?.rooms.find((room) => room.id === roomId)?.name || roomId;

  const resetForm = () => {
    setForm(createInitialForm());
    setFeedback("");
    setShowAssetsSection(false);
    setShowForm(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "box_id") {
      setForm((current) => ({
        ...current,
        box_id: value,
        selected_asset_ids: []
      }));
      return;
    }

    if (name === "location_key") {
      const selectedLocation = locationOptions.find((location) => location.key === value);
      setForm((current) => ({
        ...current,
        location_key: value,
        room_id: selectedLocation?.type === "room" ? selectedLocation.id : "",
        location_lab_id: selectedLocation?.type === "lab" ? selectedLocation.id : "",
        room_name: selectedLocation?.name || ""
      }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  };

  const toggleAssetSelection = (assetId) => {
    setForm((current) => ({
      ...current,
      selected_asset_ids: current.selected_asset_ids.includes(assetId)
        ? current.selected_asset_ids.filter((id) => id !== assetId)
        : [...current.selected_asset_ids, assetId]
    }));
  };

  const handleSelectAllAssets = () => {
    setForm((current) => ({
      ...current,
      selected_asset_ids: selectedBoxAssets.map((asset) => asset.id)
    }));
  };

  const handleClearAssets = () => {
    setForm((current) => ({ ...current, selected_asset_ids: [] }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSubmitting(true);

    try {
      if (!form.box_id || !form.session_class || !form.expected_return_at || !form.responsible_name.trim()) {
        throw new Error("Preencha carrinho, responsável, turma e previsão de devolução.");
      }

      await loansApi.create({
        box_id: form.box_id,
        responsible_name: form.responsible_name.trim(),
        room_id: form.room_id || null,
        location_lab_id: form.location_lab_id || null,
        room_name: form.room_name || null,
        session_class: form.session_class.trim(),
        expected_return_at: new Date(form.expected_return_at).toISOString(),
        notes: form.notes.trim() || null,
        selected_asset_ids: form.selected_asset_ids
      });

      setForm(createInitialForm());
      setShowAssetsSection(false);
      setShowForm(false);
      await loans.reload();
    } catch (err) {
      setFeedback(err.message || "Não foi possível registrar o empréstimo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (loan) => {
    try {
      await loansApi.markReturned(loan.id);
      await loans.reload();
    } catch (err) {
      setFeedback(err.message || "Não foi possível registrar a devolução.");
    }
  };

  const getTargetLabel = (loan) => {
    if (loan.box_id) return getBoxName(loan.box_id);
    if (loan.lab_id) return getLabName(loan.lab_id);
    return getAssetName(loan.asset_id);
  };

  const getTargetTypeLabel = (loan) => {
    if (loan.box_id) return "Carrinho";
    if (loan.lab_id) return "Laboratório";
    return "Ativo";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Movimentação e histórico de uso</h1>
        <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          <Icon name="plus" className="mr-2" />
          {showForm ? "Fechar" : "Novo empréstimo"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2" onSubmit={handleSubmit}>
            <FormField label="Carrinho">
              <Select name="box_id" value={form.box_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {lookups.data?.boxes.map((box) => (
                  <option key={box.id} value={box.id}>{box.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Responsável">
              <Input name="responsible_name" value={form.responsible_name} onChange={handleChange} />
            </FormField>
            <FormField label="Sala cadastrada">
              <Select name="location_key" value={form.location_key} onChange={handleChange}>
                <option value="">Selecione</option>
                {locationOptions.map((location) => (
                  <option key={location.key} value={location.key}>{location.label}</option>
                ))}
              </Select>
            </FormField>
            <div className="md:col-span-2">
              <div className="rounded-md border border-border bg-white">
                <button
                  type="button"
                  onClick={() => setShowAssetsSection((current) => !current)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
                >
                  <span>Ativos utilizados no empréstimo</span>
                  <span className="text-muted-foreground">{showAssetsSection ? "Recolher" : "Expandir"}</span>
                </button>
                {showAssetsSection ? (
                  <div className="space-y-3 border-t px-4 py-3">
                    {!form.box_id ? (
                      <div className="text-sm text-muted-foreground">Selecione o carrinho para listar os ativos vinculados.</div>
                    ) : selectedBoxAssets.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Nenhum ativo vinculado a este carrinho.</div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm text-muted-foreground">{selectedAssetsCount} de {selectedBoxAssets.length} ativos selecionados</div>
                          <div className="flex gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={handleSelectAllAssets}>Selecionar todos</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={handleClearAssets}>Desmarcar todos</Button>
                          </div>
                        </div>
                        <div className="max-h-72 space-y-2 overflow-y-auto">
                          {selectedBoxAssets.map((asset) => {
                            const selected = form.selected_asset_ids.includes(asset.id);
                            return (
                              <label key={asset.id} className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleAssetSelection(asset.id)}
                                  className="mt-1 h-4 w-4 rounded border-border"
                                />
                                <span>{formatAssetIdentifier(asset)}</span>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <FormField label="Turma / Disciplina">
              <Input name="session_class" value={form.session_class} onChange={handleChange} />
            </FormField>
            <FormField label="Previsão de devolução">
              <Input name="expected_return_at" type="datetime-local" value={form.expected_return_at} onChange={handleChange} />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Observações">
                <Textarea name="notes" value={form.notes} onChange={handleChange} />
              </FormField>
            </div>
            {feedback ? <div className="md:col-span-2"><InlineMessage tone="error">{feedback}</InlineMessage></div> : null}
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar empréstimo"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-4">
          <Input placeholder="Buscar movimentação..." className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Select className="max-w-44" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
            {Object.entries(targetTypeOptions).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          {loans.loading ? <div className="p-4"><LoadingState /></div> : null}
          {loans.error ? <div className="p-4"><InlineMessage tone="error">{loans.error}</InlineMessage></div> : null}
          {!loans.loading && !loans.error && loans.data?.length === 0 ? (
            <EmptyState title="Nenhuma movimentação encontrada" description="Use os filtros acima para localizar o histórico de uso por período." />
          ) : null}
          {loans.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Item</th>
                  <th>Responsável</th>
                  <th>Local / Turma</th>
                  <th>Retirada</th>
                  <th>Previsão</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loans.data.map((loan) => (
                  <tr key={loan.id} className="hover:bg-muted/50">
                    <td>{getTargetTypeLabel(loan)}</td>
                    <td className="font-medium">
                      <div>{getTargetLabel(loan)}</div>
                      {loan.box_loan_assets?.length ? (
                        <div className="text-sm font-normal text-muted-foreground">
                          {loan.box_loan_assets.length} ativos rastreados
                        </div>
                      ) : null}
                    </td>
                    <td>{loan.responsible_name}</td>
                    <td className="text-muted-foreground">{loan.room_name || getRoomName(loan.room_id) || "-"} / {loan.session_class}</td>
                    <td>{formatDateTime(loan.borrowed_at)}</td>
                    <td>{formatDateTime(loan.expected_return_at)}</td>
                    <td>
                      <Badge variant={statusMap[loan.status]?.[1] || "outline"}>
                        {statusMap[loan.status]?.[0] || loan.status}
                      </Badge>
                    </td>
                    <td>
                      {loan.status !== "returned" ? (
                        <Button size="sm" onClick={() => handleReturn(loan)}>Devolver</Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Concluído</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </Card>
    </div>
  );
};

export default LoansPage;
