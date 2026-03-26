import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, FormField, Icon, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { checklistsApi, lookupApi } from "../lib/api";
import { formatDateTime } from "../lib/utils";

const ChecklistsPage = () => {
  const [view, setView] = useState("form");
  const [form, setForm] = useState({ lab_id: "", responsible_name: "", session_class: "", notes: "" });
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const labs = useAsyncData(() => lookupApi.labs(), []);
  const recent = useAsyncData(() => checklistsApi.list(), []);
  const getLabName = (labId) => labs.data?.find((lab) => lab.id === labId)?.name || labId;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitChecklist = async (status) => {
    setFeedback("");
    setSubmitting(true);

    try {
      if (!form.lab_id || !form.responsible_name.trim() || !form.session_class.trim()) {
        throw new Error("Selecione o laboratório e informe o responsável e a disciplina.");
      }

      await checklistsApi.create({
        lab_id: form.lab_id,
        responsible_name: form.responsible_name.trim(),
        session_class: form.session_class.trim(),
        status,
        notes: form.notes.trim() || null
      });

      setForm({ lab_id: "", responsible_name: "", session_class: "", notes: "" });
      setView("success");
      await recent.reload();
    } catch (err) {
      setFeedback(err.message || "Não foi possível salvar o checklist.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Checklist de Laboratório</h1>
      <p className="text-muted-foreground">Registro rápido no início/fim da aula por professores.</p>

      {view === "form" ? (
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-lg">Nova Auto-inspeção</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Laboratório">
                <Select name="lab_id" value={form.lab_id} onChange={handleChange}>
                  <option value="">Selecione</option>
                  {labs.data?.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Responsável">
                <Input name="responsible_name" value={form.responsible_name} onChange={handleChange} placeholder="Ex: Prof. Maria" />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <FormField label="Disciplina">
                <Input name="session_class" value={form.session_class} onChange={handleChange} placeholder="Ex: Algoritmos" />
              </FormField>
            </div>

            <FormField label="Observações">
              <Textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Descreva problemas encontrados, se houver." />
            </FormField>

            {feedback ? <InlineMessage tone="error">{feedback}</InlineMessage> : null}
            {labs.loading ? <LoadingState /> : null}

            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-4">Condição Geral do Lab:</p>
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => submitChecklist("ok")}
                  className="border rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-green-50 border-green-200 transition-colors"
                >
                  <Icon name="check-circle" className="text-green-500 w-8 h-8 mb-2" />
                  <div className="font-bold text-green-700">Tudo OK</div>
                  <div className="text-xs text-muted-foreground mt-1">Nenhum problema encontrado</div>
                </div>

                <div
                  onClick={() => submitChecklist("has_issues")}
                  className="border rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-red-50 border-red-200 transition-colors"
                >
                  <Icon name="alert-triangle" className="text-red-500 w-8 h-8 mb-2" />
                  <div className="font-bold text-red-700">Reportar Problema</div>
                  <div className="text-xs text-muted-foreground mt-1">Falta hardware, avaria, etc.</div>
                </div>
              </div>
              {submitting ? <div className="mt-4"><LoadingState label="Salvando checklist..." /></div> : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-8 text-center">
            <Icon name="check-circle" className="text-green-500 w-12 h-12 mx-auto mb-4" />
            <div className="text-xl text-green-700 font-bold mb-4">Checklist Salvo!</div>
            <Button onClick={() => setView("form")}>Fazer outro</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Últimos Registros</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          {recent.loading ? <LoadingState /> : null}
          {recent.data?.map((item) => (
            <div key={item.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium">{getLabName(item.lab_id)}</div>
                <div className="text-sm text-muted-foreground">{item.responsible_name} • {item.session_class} • {formatDateTime(item.reported_at)}</div>
              </div>
              <Badge variant={item.status === "ok" ? "success" : "warning"}>
                {item.status === "ok" ? "Tudo OK" : "Com Problemas"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChecklistsPage;
