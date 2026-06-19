import { Construction, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

interface ComingSoonProps {
  title: string
  icon: LucideIcon
  note?: string
}

export function ComingSoon({ title, icon, note }: ComingSoonProps): JSX.Element {
  return (
    <>
      <PageHeader title={title} icon={icon} subtitle="PART OF THE BUILD ROADMAP" />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="rounded-full bg-primary/10 p-4 text-primary">
            <Construction className="h-8 w-8" />
          </div>
          <div className="text-lg font-semibold tracking-tight">COMING IN THE NEXT BUILD STEP</div>
          {note && <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{note}</p>}
        </CardContent>
      </Card>
    </>
  )
}
