import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FormField, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { incidentsApi, loansApi, lookupApi, publicScanApi } from "../lib/api";
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

const PublicBoxPage = () => {
  const { boxId } = useParams();
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
      const data = await publicScanApi.getBoxContext(boxId);
      if (!data) {
        throw new Error("Carrinho não encontrado para este QR Code.");
      }

      setContext(data);
      setReturnForm(createReturnForm(data));
    } catch (err) {
      setContext(null);
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
      if (!borrowForm.responsible_name.trim() || !borrowForm.room_id || !borrowForm.session_class.trim() || !borrowForm.expected_return_at) {
        throw new Error("Preencha responsável, sala, turma e previsão de devolução.");
      }

      const loanId = await publicScanApi.requestLoanByBox({
        box_id: context.box_id,
        responsible_name: borrowForm.responsible_name.trim(),
        room_id: borrowForm.room_id,
        session_class: borrowForm.session_class.trim(),
        expected_return_at: new Date(borrowForm.expected_return_at).toISOString(),
        notes: borrowForm.notes.trim() || null
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
      <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
        <div className="space-y-2">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Acesso público por QR Code</div>
          <h1 className="text-3xl font-bold tracking-tight">Carrinho para retirada geral</h1>
          <p className="text-muted-foreground">Use este QR para retirada e devolução do carrinho completo com checklist rápido.</p>
        </div>

        {feedback ? <InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage> : null}
        {loading ? <LoadingState label="Carregando carrinho..." /> : null}

        {context ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-1">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle>Dados do carrinho</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
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
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={context.active_loan_id ? "warning" : "success"}>
                    {context.active_loan_id ? "Emprestado" : "Disponível"}
                  </Badge>
                  <Badge variant={context.is_complete === false ? "destructive" : "outline"}>
                    {context.is_complete === null ? "Sem meta" : context.is_complete ? "Completo" : "Incompleto"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="xl:col-span-2 space-y-6">
              {context.active_loan_id ? (
                <Card>
                  <CardHeader className="border-b bg-muted/20">
                    <CardTitle>Devolução do carrinho</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleReturn}>
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
                      <div className="md:col-span-2 flex justify-end">
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
                    <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleBorrow}>
                      <FormField label="Responsável">
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
                      <div className="md:col-span-2 flex justify-end">
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
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
