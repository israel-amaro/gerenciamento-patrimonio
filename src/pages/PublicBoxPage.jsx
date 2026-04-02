import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FormField, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { incidentsApi, loansApi, lookupApi, publicScanApi } from "../lib/api";
import { buildLocationOptions, formatAssetIdentifier, formatDateTime } from "../lib/utils";

const checklistOptions = [
  { value: "ok", label: "Tudo OK" },
  { value: "has_issues", label: "Com problema" }
];

const createBorrowForm = () => {
  const expectedReturnDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const localIso = new Date(expectedReturnDate.getTime() - expectedReturnDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return {
    responsible_name: "",
    location_key: "",
    room_id: "",
    location_lab_id: "",
    room_name: "",
    session_class: "",
    expected_return_at: localIso,
    notes: "",
    checklist_status: "ok",
    checklist_notes: "",
    selected_asset_ids: []
  };
};

const createReturnForm = (context) => ({
  responsible_name: context?.responsible_name || "",
  session_class: context?.session_class || "",
  checklist_status: "ok",
  checklist_notes: ""
});

const PublicBoxPage = () => {
  const { boxId } = useParams();
  const [context, setContext] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [labs, setLabs] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [borrowForm, setBorrowForm] = useState(createBorrowForm);
  const [returnForm, setReturnForm] = useState(createReturnForm(null));
  const [showAssetsSection, setShowAssetsSection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [borrowing, setBorrowing] = useState(false);
  const [returning, setReturning] = useState(false);

  const locationOptions = useMemo(() => buildLocationOptions({ rooms, labs }), [rooms, labs]);
  const selectedAssetsCount = borrowForm.selected_asset_ids.length;

  const loadContext = async () => {
    setLoading(true);
    setFeedback("");

    try {
      const [boxContext, boxAssets] = await Promise.all([
        publicScanApi.getBoxContext(boxId),
        publicScanApi.getPublicBoxAssets(boxId)
      ]);

      if (!boxContext) {
        throw new Error("Carrinho não encontrado para este QR Code.");
      }

      setContext(boxContext);
      setAvailableAssets(boxAssets || []);
      setReturnForm(createReturnForm(boxContext));
    } catch (err) {
      setContext(null);
      setAvailableAssets([]);
      setFeedback(err.message || "Não foi possível carregar o carrinho.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, [boxId]);

  useEffect(() => {
    let active = true;

    const loadLocations = async () => {
      try {
        const data = await lookupApi.loanLocations();
        if (active) {
          setRooms(data.rooms || []);
          setLabs(data.labs || []);
        }
      } finally {
        if (active) {
          setLocationsLoading(false);
        }
      }
    };

    loadLocations();

    return () => {
      active = false;
    };
  }, []);

  const handleBorrowChange = (event) => {
    const { name, value } = event.target;

    if (name === "location_key") {
      const selectedLocation = locationOptions.find((location) => location.key === value);
      setBorrowForm((current) => ({
        ...current,
        location_key: value,
        room_id: selectedLocation?.type === "room" ? selectedLocation.id : "",
        location_lab_id: selectedLocation?.type === "lab" ? selectedLocation.id : "",
        room_name: selectedLocation?.name || ""
      }));
      return;
    }

    setBorrowForm((current) => ({ ...current, [name]: value }));
  };

  const handleReturnChange = (event) => {
    const { name, value } = event.target;
    setReturnForm((current) => ({ ...current, [name]: value }));
  };

  const toggleAssetSelection = (assetId) => {
    setBorrowForm((current) => ({
      ...current,
      selected_asset_ids: current.selected_asset_ids.includes(assetId)
        ? current.selected_asset_ids.filter((id) => id !== assetId)
        : [...current.selected_asset_ids, assetId]
    }));
  };

  const handleSelectAllAssets = () => {
    setBorrowForm((current) => ({
      ...current,
      selected_asset_ids: availableAssets.map((asset) => asset.asset_id)
    }));
  };

  const handleClearAssets = () => {
    setBorrowForm((current) => ({ ...current, selected_asset_ids: [] }));
  };

  const handleBorrow = async (event) => {
    event.preventDefault();
    setFeedback("");
    setBorrowing(true);

    try {
      if (!borrowForm.responsible_name.trim() || !borrowForm.session_class.trim() || !borrowForm.expected_return_at) {
        throw new Error("Preencha responsável, turma e previsão de devolução.");
      }

      const loanId = await publicScanApi.requestLoanByBox({
        box_id: context.box_id,
        responsible_name: borrowForm.responsible_name.trim(),
        room_id: borrowForm.room_id || null,
        location_lab_id: borrowForm.location_lab_id || null,
        room_name: borrowForm.room_name || null,
        session_class: borrowForm.session_class.trim(),
        expected_return_at: new Date(borrowForm.expected_return_at).toISOString(),
        notes: borrowForm.notes.trim() || null,
        selected_asset_ids: borrowForm.selected_asset_ids
      });

      await publicScanApi.submitBoxChecklist({
        box_id: context.box_id,
        loan_id: loanId,
        responsible_name: borrowForm.responsible_name.trim(),
        session_class: borrowForm.session_class.trim(),
        stage: "pickup",
        status: borrowForm.checklist_status,
        notes: borrowForm.checklist_notes.trim() || null
      });

      if (borrowForm.checklist_status === "has_issues") {
        await incidentsApi.createEvent({
          box_id: context.box_id,
          title: `Problema reportado na retirada do carrinho ${context.box_name}`,
          description: borrowForm.checklist_notes.trim() || "O checklist de retirada registrou problemas no carrinho.",
          severity: "medium",
          source: "return_flow",
          source_reference_id: loanId
        });
      }

      setBorrowForm(createBorrowForm());
      setShowAssetsSection(false);
      setFeedback("Retirada do carrinho registrada com sucesso.");
      await loadContext();
    } catch (err) {
      setFeedback(err.message || "Não foi possível registrar a retirada.");
    } finally {
      setBorrowing(false);
    }
  };

  const handleReturn = async (event) => {
    event.preventDefault();
    setFeedback("");
    setReturning(true);

    try {
      if (!context?.active_loan_id) {
        throw new Error("Não existe retirada ativa para este carrinho.");
      }

      await publicScanApi.submitBoxChecklist({
        box_id: context.box_id,
        loan_id: context.active_loan_id,
        responsible_name: returnForm.responsible_name.trim(),
        session_class: returnForm.session_class.trim(),
        stage: "return",
        status: returnForm.checklist_status,
        notes: returnForm.checklist_notes.trim() || null
      });

      if (returnForm.checklist_status === "has_issues") {
        await incidentsApi.createEvent({
          box_id: context.box_id,
          title: `Problema reportado na devolução do carrinho ${context.box_name}`,
          description: returnForm.checklist_notes.trim() || "O checklist de devolução registrou problemas no carrinho.",
          severity: "medium",
          source: "return_flow",
          source_reference_id: context.active_loan_id
        });
      }

      await loansApi.markReturned(context.active_loan_id);

      setFeedback("Devolução do carrinho registrada com sucesso.");
      await loadContext();
    } catch (err) {
      setFeedback(err.message || "Não foi possível registrar a devolução.");
    } finally {
      setReturning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="space-y-2">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Acesso público por QR Code</div>
          <h1 className="text-3xl font-bold tracking-tight">Carrinho para retirada geral</h1>
          <p className="text-muted-foreground">Use este QR para retirada e devolução do carrinho completo com checklist rápido.</p>
        </div>

        {feedback ? <InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage> : null}
        {loading ? <LoadingState label="Carregando carrinho..." /> : null}

        {context ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle>Dados do carrinho</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Nome</div>
                  <div className="font-semibold">{context.box_name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Tipo</div>
                  <div>Carrinho móvel</div>
                  <div className="text-sm text-muted-foreground">Fluxo independente com checklist próprio.</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Descrição</div>
                  <div>{context.box_description || "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Quantidade atual</div>
                  <div>{context.current_asset_count} ativos</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Esperado</div>
                  <div>{context.expected_asset_count || "-"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={context.active_loan_id ? "warning" : "success"}>
                    {context.active_loan_id ? "Emprestado" : "Disponível"}
                  </Badge>
                  <Badge variant={context.is_complete === false ? "destructive" : "outline"}>
                    {context.is_complete === null ? "Sem meta" : context.is_complete ? "Completo" : "Incompleto"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6 xl:col-span-2">
              {context.active_loan_id ? (
                <Card>
                  <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Devolução do carrinho</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleReturn}>
                      <FormField label="Responsável">
                        <Input name="responsible_name" value={returnForm.responsible_name} onChange={handleReturnChange} />
                      </FormField>
                      <FormField label="Turma / Disciplina">
                        <Input name="session_class" value={returnForm.session_class} onChange={handleReturnChange} />
                      </FormField>
                      <FormField label="Checklist rápido">
                        <Select name="checklist_status" value={returnForm.checklist_status} onChange={handleReturnChange}>
                          {checklistOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </FormField>
                      <div className="md:col-span-2">
                        <FormField label="Observações">
                          <Textarea name="checklist_notes" value={returnForm.checklist_notes} onChange={handleReturnChange} />
                        </FormField>
                      </div>
                      <div className="flex justify-end md:col-span-2">
                        <Button type="submit" disabled={returning}>{returning ? "Salvando..." : "Devolver e salvar checklist"}</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Novo empréstimo do carrinho</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleBorrow}>
                      <FormField label="Responsável">
                        <Input name="responsible_name" value={borrowForm.responsible_name} onChange={handleBorrowChange} placeholder="Ex: Prof. Maria" />
                      </FormField>
                      <FormField label="Sala cadastrada">
                        <Select name="location_key" value={borrowForm.location_key} onChange={handleBorrowChange} disabled={locationsLoading}>
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
                              {availableAssets.length === 0 ? (
                                <div className="text-sm text-muted-foreground">Nenhum ativo vinculado a este carrinho.</div>
                              ) : (
                                <>
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-sm text-muted-foreground">{selectedAssetsCount} de {availableAssets.length} ativos selecionados</div>
                                    <div className="flex gap-2">
                                      <Button type="button" variant="ghost" size="sm" onClick={handleSelectAllAssets}>Selecionar todos</Button>
                                      <Button type="button" variant="ghost" size="sm" onClick={handleClearAssets}>Desmarcar todos</Button>
                                    </div>
                                  </div>
                                  <div className="max-h-72 space-y-2 overflow-y-auto">
                                    {availableAssets.map((asset) => {
                                      const selected = borrowForm.selected_asset_ids.includes(asset.asset_id);
                                      return (
                                        <label key={asset.asset_id} className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                                          <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => toggleAssetSelection(asset.asset_id)}
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
                        <Input name="session_class" value={borrowForm.session_class} onChange={handleBorrowChange} />
                      </FormField>
                      <FormField label="Previsão de devolução">
                        <Input name="expected_return_at" type="datetime-local" value={borrowForm.expected_return_at} onChange={handleBorrowChange} />
                      </FormField>
                      <div className="md:col-span-2">
                        <FormField label="Observações do empréstimo">
                          <Textarea name="notes" value={borrowForm.notes} onChange={handleBorrowChange} />
                        </FormField>
                      </div>
                      <FormField label="Checklist rápido">
                        <Select name="checklist_status" value={borrowForm.checklist_status} onChange={handleBorrowChange}>
                          {checklistOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </FormField>
                      <div className="md:col-span-2">
                        <FormField label="Observações do checklist">
                          <Textarea name="checklist_notes" value={borrowForm.checklist_notes} onChange={handleBorrowChange} />
                        </FormField>
                      </div>
                      <div className="flex justify-end md:col-span-2">
                        <Button type="submit" disabled={borrowing}>{borrowing ? "Salvando..." : "Emprestar e salvar checklist"}</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle>Resumo do uso</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Responsável atual</div>
                    <div>{context.responsible_name || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Última retirada</div>
                    <div>{formatDateTime(context.borrowed_at)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Previsão</div>
                    <div>{formatDateTime(context.expected_return_at)}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PublicBoxPage;
