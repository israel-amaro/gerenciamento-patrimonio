import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FormField, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { checklistsApi, incidentsApi, loansApi, lookupApi, publicScanApi } from "../lib/api";
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
    room_name: "",
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

const buildChecklistNotes = ({ stage, context, notes }) =>
  [`[${stage}] Laboratório ${context.lab_name}`, notes?.trim()].filter(Boolean).join(" - ");

const PublicLabPage = () => {
  const { labId } = useParams();
  const [context, setContext] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [borrowForm, setBorrowForm] = useState(createBorrowForm);
  const [returnForm, setReturnForm] = useState(createReturnForm(null));
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [borrowing, setBorrowing] = useState(false);
  const [returning, setReturning] = useState(false);

  const loadContext = async () => {
    setLoading(true);
    setFeedback("");

    try {
      const data = await publicScanApi.getLabContext(labId);
      if (!data) {
        throw new Error("Laboratório não encontrado para este QR Code.");
      }

      setContext(data);
      setReturnForm(createReturnForm(data));
    } catch (err) {
      setContext(null);
      setFeedback(err.message || "Não foi possível carregar o laboratório.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  }, [labId]);

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

    if (name === "room_id") {
      const selectedRoom = rooms.find((room) => room.id === value);
      setBorrowForm((current) => ({
        ...current,
        room_id: value,
        room_name: selectedRoom?.name || current.room_name
      }));
      return;
    }

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
      if (!borrowForm.responsible_name.trim() || !borrowForm.session_class.trim() || !borrowForm.expected_return_at) {
        throw new Error("Preencha responsável, turma e previsão de devolução.");
      }

      await publicScanApi.requestLoanByLab({
        lab_id: context.lab_id,
        responsible_name: borrowForm.responsible_name.trim(),
        room_id: borrowForm.room_id || null,
        room_name: borrowForm.room_name.trim() || null,
        session_class: borrowForm.session_class.trim(),
        expected_return_at: new Date(borrowForm.expected_return_at).toISOString(),
        notes: borrowForm.notes.trim() || null
      });

      const checklistId = await checklistsApi.create({
        lab_id: context.lab_id,
        responsible_name: borrowForm.responsible_name.trim(),
        session_class: borrowForm.session_class.trim(),
        status: borrowForm.checklist_status,
        notes: buildChecklistNotes({ stage: "RETIRADA", context, notes: borrowForm.checklist_notes })
      });

      if (borrowForm.checklist_status === "has_issues") {
        await incidentsApi.createEvent({
          lab_id: context.lab_id,
          title: `Problema reportado na retirada do laboratório ${context.lab_name}`,
          description: borrowForm.checklist_notes.trim() || "O checklist de retirada registrou problemas no laboratório.",
          severity: "medium",
          source: "professor_checklist",
          source_reference_id: checklistId
        });
      }

      setBorrowForm(createBorrowForm());
      setFeedback("Uso do laboratório registrado com sucesso.");
      await loadContext();
    } catch (err) {
      setFeedback(err.message || "Não foi possível registrar o uso do laboratório.");
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
        throw new Error("Não existe uso ativo para este laboratório.");
      }

      await loansApi.markReturned(context.active_loan_id);

      const checklistId = await checklistsApi.create({
        lab_id: context.lab_id,
        responsible_name: returnForm.responsible_name.trim(),
        session_class: returnForm.session_class.trim(),
        status: returnForm.checklist_status,
        notes: buildChecklistNotes({ stage: "DEVOLUÇÃO", context, notes: returnForm.checklist_notes })
      });

      if (returnForm.checklist_status === "has_issues") {
        await incidentsApi.createEvent({
          lab_id: context.lab_id,
          title: `Problema reportado na devolução do laboratório ${context.lab_name}`,
          description: returnForm.checklist_notes.trim() || "O checklist de devolução registrou problemas no laboratório.",
          severity: "medium",
          source: "return_flow",
          source_reference_id: checklistId
        });
      }

      setFeedback("Devolução do laboratório registrada com sucesso.");
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
          <h1 className="text-3xl font-bold tracking-tight">Laboratório para retirada geral</h1>
          <p className="text-muted-foreground">Use este QR para registrar o uso do laboratório com checklist de início e fim.</p>
        </div>

        {feedback ? <InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage> : null}
        {loading ? <LoadingState label="Carregando laboratório..." /> : null}

        {context ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle>Dados do laboratório</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Nome</div>
                  <div className="font-semibold">{context.lab_name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Localização</div>
                  <div>{context.lab_location || "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Quantidade de ativos</div>
                  <div>{context.asset_count}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={context.active_loan_id ? "warning" : "success"}>
                    {context.active_loan_id ? "Em uso" : "Disponível"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6 xl:col-span-2">
              {context.active_loan_id ? (
                <Card>
                  <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Devolução do laboratório</CardTitle>
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
                        <Button type="submit" disabled={returning}>{returning ? "Salvando..." : "Encerrar uso e salvar checklist"}</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Novo uso do laboratório</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleBorrow}>
                      <FormField label="Responsável">
                        <Input name="responsible_name" value={borrowForm.responsible_name} onChange={handleBorrowChange} />
                      </FormField>
                      <FormField label="Sala cadastrada">
                        <Select name="room_id" value={borrowForm.room_id} onChange={handleBorrowChange} disabled={roomsLoading}>
                          <option value="">Selecione</option>
                          {rooms.map((room) => (
                            <option key={room.id} value={room.id}>{room.name}</option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Sala / Local livre">
                        <Input name="room_name" value={borrowForm.room_name} onChange={handleBorrowChange} placeholder="Ex: Sala 14, Bloco A" />
                      </FormField>
                      <FormField label="Turma / Disciplina">
                        <Input name="session_class" value={borrowForm.session_class} onChange={handleBorrowChange} />
                      </FormField>
                      <FormField label="Previsão de devolução">
                        <Input name="expected_return_at" type="datetime-local" value={borrowForm.expected_return_at} onChange={handleBorrowChange} />
                      </FormField>
                      <div className="md:col-span-2">
                        <FormField label="Observações do uso">
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
                        <Button type="submit" disabled={borrowing}>{borrowing ? "Salvando..." : "Registrar uso e salvar checklist"}</Button>
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
                    <div className="text-xs uppercase text-muted-foreground">Início</div>
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

export default PublicLabPage;
