import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FormField, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { checklistsApi, lookupApi, loansApi, publicAssetsApi } from "../lib/api";
import { formatDateTime } from "../lib/utils";

const checklistOptions = [
  { value: "ok", label: "Tudo OK" },
  { value: "has_issues", label: "Com problema" }
];

const createBorrowForm = () => {
  const expectedReturnDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const localIso = new Date(expectedReturnDate.getTime() - expectedReturnDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return {
    responsible_name: "",
    room_id: "",
    session_class: "",
    expected_return_at: localIso,
    notes: "",
    checklist_status: "ok",
    checklist_notes: ""
  };
};

const createReturnForm = (context) => ({
  responsible_name: context?.responsible_name || "",
  session_class: context?.session_class || "",
  checklist_status: "ok",
  checklist_notes: ""
});

const buildChecklistNotes = ({ stage, context, notes }) => {
  const header = `[${stage}] Ativo ${context.tag_code} | ${context.model}`;
  const boxInfo = context.box_name ? ` | Caixa ${context.box_name}` : "";
  const customNotes = notes?.trim();

  return [header + boxInfo, customNotes].filter(Boolean).join(" - ");
};

const PublicAssetPage = () => {
  const { assetId } = useParams();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [borrowForm, setBorrowForm] = useState(createBorrowForm);
  const [returnForm, setReturnForm] = useState(createReturnForm(null));
  const [borrowing, setBorrowing] = useState(false);
  const [returning, setReturning] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  const canBorrow = Boolean(context?.box_id && !context?.active_loan_id && context?.lab_id);
  const canReturn = Boolean(context?.active_loan_id && context?.lab_id);

  const loadContext = async () => {
    setLoading(true);

    try {
      const data = await publicAssetsApi.getContext(assetId);
      if (!data) {
        throw new Error("Ativo nao encontrado para este QR Code.");
      }

      setContext(data);
      setReturnForm(createReturnForm(data));
    } catch (err) {
      setContext(null);
      setFeedback(err.message || "Nao foi possivel carregar o ativo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, [assetId]);

  useEffect(() => {
    let active = true;

    const loadRooms = async () => {
      try {
        const data = await lookupApi.rooms();
        if (active) {
          setRooms(data);
        }
      } finally {
        if (active) {
          setRoomsLoading(false);
        }
      }
    };

    loadRooms();

    return () => {
      active = false;
    };
  }, []);

  const handleBorrowChange = (event) => {
    const { name, value } = event.target;
    setBorrowForm((current) => ({ ...current, [name]: value }));
  };

  const handleReturnChange = (event) => {
    const { name, value } = event.target;
    setReturnForm((current) => ({ ...current, [name]: value }));
  };

  const handleBorrow = async (event) => {
    event.preventDefault();
    setFeedback("");
    setBorrowing(true);

    try {
      if (!context?.lab_id) {
        throw new Error("Este ativo precisa estar vinculado a um laboratorio para liberar checklist e emprestimo pelo QR.");
      }

      if (!borrowForm.responsible_name.trim() || !borrowForm.room_id || !borrowForm.session_class.trim() || !borrowForm.expected_return_at) {
        throw new Error("Preencha responsavel, sala, turma e previsao de devolucao.");
      }

      await publicAssetsApi.requestLoanByAsset({
        asset_id: context.asset_id,
        responsible_name: borrowForm.responsible_name.trim(),
        room_id: borrowForm.room_id,
        session_class: borrowForm.session_class.trim(),
        expected_return_at: new Date(borrowForm.expected_return_at).toISOString(),
        notes: borrowForm.notes.trim() || null
      });

      await checklistsApi.create({
        lab_id: context.lab_id,
        responsible_name: borrowForm.responsible_name.trim(),
        session_class: borrowForm.session_class.trim(),
        status: borrowForm.checklist_status,
        notes: buildChecklistNotes({
          stage: "RETIRADA",
          context,
          notes: borrowForm.checklist_notes
        })
      });

      setFeedback("Emprestimo e checklist de retirada salvos com sucesso.");
      setBorrowForm(createBorrowForm());
      await loadContext();
    } catch (err) {
      setFeedback(err.message || "Nao foi possivel registrar o emprestimo.");
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
        throw new Error("Nao existe emprestimo ativo para este item.");
      }

      if (!context?.lab_id) {
        throw new Error("Este ativo precisa estar vinculado a um laboratorio para registrar checklist na devolucao.");
      }

      if (!returnForm.responsible_name.trim() || !returnForm.session_class.trim()) {
        throw new Error("Informe responsavel e turma para a devolucao.");
      }

      await loansApi.markReturned(context.active_loan_id);

      await checklistsApi.create({
        lab_id: context.lab_id,
        responsible_name: returnForm.responsible_name.trim(),
        session_class: returnForm.session_class.trim(),
        status: returnForm.checklist_status,
        notes: buildChecklistNotes({
          stage: "DEVOLUCAO",
          context,
          notes: returnForm.checklist_notes
        })
      });

      setFeedback("Devolucao e checklist final salvos com sucesso.");
      await loadContext();
    } catch (err) {
      setFeedback(err.message || "Nao foi possivel registrar a devolucao.");
    } finally {
      setReturning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
        <div className="space-y-2">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Acesso publico por QR Code</div>
          <h1 className="text-3xl font-bold tracking-tight">Consulta do ativo e fluxo rapido</h1>
          <p className="text-muted-foreground">Veja os dados gerais do equipamento, registre emprestimo e finalize com checklist rapido.</p>
        </div>

        {feedback ? <InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage> : null}

        {loading ? <LoadingState label="Carregando dados do ativo..." /> : null}

        {context ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-1">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle>Informacoes do ativo</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Patrimonio</div>
                  <div className="font-semibold">{context.tag_code}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Modelo</div>
                  <div>{context.model}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Nome da maquina</div>
                  <div>{context.host_name || "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Dominio</div>
                  <div>{context.domain_name || "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Serial</div>
                  <div>{context.serial_number || "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Laboratorio</div>
                  <div>{context.lab_name || "Nao vinculado"}</div>
                  <div className="text-sm text-muted-foreground">{context.lab_location || "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Caixa</div>
                  <div>{context.box_name || "Sem caixa vinculada"}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={context.active_loan_id ? "warning" : "success"}>
                    {context.active_loan_id ? "Emprestado" : "Disponivel"}
                  </Badge>
                  <Badge variant="outline">{context.asset_status}</Badge>
                </div>
                {!context.lab_id ? (
                  <InlineMessage tone="error">
                    Este ativo ainda nao tem laboratorio vinculado. Cadastre um laboratorio para liberar checklist via QR.
                  </InlineMessage>
                ) : null}
              </CardContent>
            </Card>

            <div className="xl:col-span-2 space-y-6">
              {context.active_loan_id ? (
                <Card>
                  <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Devolucao rapida</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">Responsavel atual</div>
                        <div className="font-medium">{context.responsible_name || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">Turma</div>
                        <div className="font-medium">{context.session_class || "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">Previsao</div>
                        <div className="font-medium">{formatDateTime(context.expected_return_at)}</div>
                      </div>
                    </div>

                    <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleReturn}>
                      <FormField label="Responsavel pela devolucao">
                        <Input name="responsible_name" value={returnForm.responsible_name} onChange={handleReturnChange} />
                      </FormField>
                      <FormField label="Turma / Disciplina">
                        <Input name="session_class" value={returnForm.session_class} onChange={handleReturnChange} />
                      </FormField>
                      <FormField label="Checklist rapido">
                        <Select name="checklist_status" value={returnForm.checklist_status} onChange={handleReturnChange}>
                          {checklistOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </FormField>
                      <div className="md:col-span-2">
                        <FormField label="Observacoes da devolucao">
                          <Textarea
                            name="checklist_notes"
                            value={returnForm.checklist_notes}
                            onChange={handleReturnChange}
                            placeholder="Informe rapidamente se faltou algo ou se encontrou algum problema."
                          />
                        </FormField>
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <Button type="submit" disabled={returning}>
                          {returning ? "Salvando..." : "Devolver e salvar checklist"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Novo emprestimo</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {context.box_id ? (
                      <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleBorrow}>
                        <FormField label="Responsavel">
                          <Input name="responsible_name" value={borrowForm.responsible_name} onChange={handleBorrowChange} placeholder="Ex: Prof. Maria" />
                        </FormField>
                        <FormField label="Sala">
                          <Select name="room_id" value={borrowForm.room_id} onChange={handleBorrowChange} disabled={roomsLoading}>
                            <option value="">Selecione</option>
                            {rooms.map((room) => (
                              <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField label="Turma / Disciplina">
                          <Input name="session_class" value={borrowForm.session_class} onChange={handleBorrowChange} placeholder="Ex: Redes 2A" />
                        </FormField>
                        <FormField label="Previsao de devolucao">
                          <Input name="expected_return_at" type="datetime-local" value={borrowForm.expected_return_at} onChange={handleBorrowChange} />
                        </FormField>
                        <div className="md:col-span-2">
                          <FormField label="Observacoes do emprestimo">
                            <Textarea
                              name="notes"
                              value={borrowForm.notes}
                              onChange={handleBorrowChange}
                              placeholder="Informacoes adicionais sobre a retirada."
                            />
                          </FormField>
                        </div>
                        <FormField label="Checklist rapido">
                          <Select name="checklist_status" value={borrowForm.checklist_status} onChange={handleBorrowChange}>
                            {checklistOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </Select>
                        </FormField>
                        <div className="md:col-span-2">
                          <FormField label="Observacoes do checklist">
                            <Textarea
                              name="checklist_notes"
                              value={borrowForm.checklist_notes}
                              onChange={handleBorrowChange}
                              placeholder="Ex: equipamento ligado, perifericos presentes, problema observado."
                            />
                          </FormField>
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                          <Button type="submit" disabled={!canBorrow || borrowing}>
                            {borrowing ? "Salvando..." : "Emprestar e salvar checklist"}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <InlineMessage tone="error">
                        Este ativo ainda nao esta vinculado a uma caixa, entao o emprestimo por QR nao pode ser feito.
                      </InlineMessage>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle>Resumo do uso</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Caixa</div>
                    <div className="font-medium">{context.box_name || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Status da caixa</div>
                    <div className="font-medium">{context.box_status || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Ultima retirada</div>
                    <div className="font-medium">{formatDateTime(context.borrowed_at)}</div>
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

export default PublicAssetPage;
