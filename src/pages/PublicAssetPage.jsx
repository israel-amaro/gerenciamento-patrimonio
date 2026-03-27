import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, Card, CardContent, CardHeader, CardTitle, InlineMessage, LoadingState } from "../components/ui";
import { publicScanApi } from "../lib/api";
import { formatDateTime } from "../lib/utils";

const PublicAssetPage = () => {
  const { assetId } = useParams();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await publicScanApi.getAssetContext(assetId);
        if (!data) {
          throw new Error("Ativo nao encontrado para este QR Code.");
        }

        if (active) {
          setContext(data);
        }
      } catch (err) {
        if (active) {
          setContext(null);
          setError(err.message || "Nao foi possivel carregar o ativo.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [assetId]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-6">
        <div className="space-y-2">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Acesso publico por QR Code</div>
          <h1 className="text-3xl font-bold tracking-tight">Informacoes do ativo</h1>
          <p className="text-muted-foreground">QR individual usado para consulta rapida e apoio na auditoria tecnica.</p>
        </div>

        {loading ? <LoadingState label="Carregando dados do ativo..." /> : null}
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

        {context ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <CardTitle>Dados gerais</CardTitle>
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
                  <div className="text-xs uppercase text-muted-foreground">Carrinho</div>
                  <div>{context.box_name || "Sem carrinho vinculado"}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={context.active_loan_id ? "warning" : "success"}>
                    {context.active_loan_id ? "Em uso" : "Disponivel"}
                  </Badge>
                  <Badge variant="outline">{context.asset_status}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b bg-muted/20">
                <CardTitle>Resumo dos usos</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Contexto atual</div>
                  <div>{context.active_loan_id ? "Associado a uma retirada em andamento" : "Sem retirada ativa"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Responsavel atual</div>
                  <div>{context.responsible_name || "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Turma / Disciplina</div>
                  <div>{context.session_class || "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Ultima retirada</div>
                  <div>{formatDateTime(context.borrowed_at)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Previsao de devolucao</div>
                  <div>{formatDateTime(context.expected_return_at)}</div>
                </div>
                <InlineMessage tone="neutral">
                  Este QR individual nao faz emprestimo. Use o QR geral do carrinho ou do laboratorio para retirada e devolucao.
                </InlineMessage>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PublicAssetPage;
