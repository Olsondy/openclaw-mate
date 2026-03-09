import { ShieldAlert, X } from 'lucide-react'
import { Button, Card } from '../../ui'

interface Props {
  onClose: () => void
}

export function ChannelAuthDialog({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-surface-on">渠道授权提示</h2>
          </div>
          <button
            onClick={onClose}
            className="text-surface-on-variant hover:text-surface-on transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-surface-on-variant mb-4">
          当前存在未完成的渠道授权。请在对应渠道客户端按提示完成授权；完成后此提示会自动消失。
        </p>

        <Button variant="outlined" onClick={onClose} className="w-full">
          我知道了
        </Button>
      </Card>
    </div>
  )
}
