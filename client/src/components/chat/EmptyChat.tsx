import { LucideMessageSquare } from 'lucide-react'

export default function EmptyChat() {
  return (
    <div className="flex-1 bg-background border-t border-border md:border-t-0 md:border-l">
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center p-6 text-center">
        <div className="bg-secondary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <LucideMessageSquare className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">WhatsApp Web</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Envie e receba mensagens sem precisar manter seu telefone conectado.
          Use o WhatsApp em até 4 dispositivos vinculados e 1 telefone por vez.
        </p>
        <p className="text-xs text-muted-foreground">
          Selecione um contato para iniciar uma conversa
        </p>
      </div>
    </div>
  )
}
