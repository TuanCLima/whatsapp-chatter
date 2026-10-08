import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface TimeBlock {
  id: string
  start: number // minutes from midnight (0-1440)
  end: number // minutes from midnight (0-1440)
  type?: 'regular' | 'tentative' // regular = guaranteed availability, tentative = potential availability
}

interface DaySchedule {
  enabled: boolean
  blocks: TimeBlock[]
}

interface WeekSchedule {
  monday: DaySchedule
  tuesday: DaySchedule
  wednesday: DaySchedule
  thursday: DaySchedule
  friday: DaySchedule
  saturday: DaySchedule
  sunday: DaySchedule
}

interface WeeklySchedulerProps {
  schedule: WeekSchedule
  onChange: (schedule: WeekSchedule) => void
}

const DAYS = [
  { key: 'sunday', label: 'Sun' },
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
] as const

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const PIXELS_PER_HOUR = 55
const TOTAL_HEIGHT = PIXELS_PER_HOUR * 24
const WEEK_TABLE_HEADER_HEIGHT = 44
const SCHEDULE_VIEWPORT_HEIGHT = 800

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export default function WeeklyScheduler({
  schedule,
  onChange,
}: WeeklySchedulerProps) {
  const [dragging, setDragging] = useState<{
    day: keyof WeekSchedule
    blockId: string
    edge: 'top' | 'bottom'
    startY: number
    startMinutes: number
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const updateSchedule = useCallback(
    (day: keyof WeekSchedule, updater: (prev: DaySchedule) => DaySchedule) => {
      onChange({
        ...schedule,
        [day]: updater(schedule[day]),
      })
    },
    [schedule, onChange],
  )

  const addBlock = (
    day: keyof WeekSchedule,
    type: 'regular' | 'tentative' = 'regular',
  ) => {
    const newBlock: TimeBlock = {
      id: `${Date.now()}-${Math.random()}`,
      start: 540, // 9:00 AM
      end: 1020, // 5:00 PM
      type,
    }

    updateSchedule(day, (prev) => ({
      ...prev,
      enabled: true,
      blocks: [...prev.blocks, newBlock],
    }))
  }

  const removeBlock = (day: keyof WeekSchedule, blockId: string) => {
    updateSchedule(day, (prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== blockId),
    }))
  }

  const handleMouseDown = (
    e: React.MouseEvent,
    day: keyof WeekSchedule,
    blockId: string,
    edge: 'top' | 'bottom',
  ) => {
    e.preventDefault()
    const block = schedule[day].blocks.find((b) => b.id === blockId)
    if (!block) return

    setDragging({
      day,
      blockId,
      edge,
      startY: e.clientY,
      startMinutes: edge === 'top' ? block.start : block.end,
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return

      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const relativeY = e.clientY - rect.top - WEEK_TABLE_HEADER_HEIGHT
      const minutes = Math.max(
        0,
        Math.min(1440, Math.round((relativeY / TOTAL_HEIGHT) * 1440)),
      )

      // Snap to 15-minute intervals
      const snappedMinutes = Math.round(minutes / 15) * 15

      updateSchedule(dragging.day, (prev) => ({
        ...prev,
        blocks: prev.blocks.map((block) => {
          if (block.id !== dragging.blockId) return block

          if (dragging.edge === 'top') {
            const start = Math.min(snappedMinutes, block.end - 15)
            if (block.end - start < 30) {
              return block
            }

            return {
              ...block,
              start,
            }
          } else {
            const end = Math.min(snappedMinutes, block.end + 15)
            if (end - block.start < 30) {
              return block
            }
            return {
              ...block,
              end,
            }
          }
        }),
      }))
    }

    const handleMouseUp = () => {
      setDragging(null)
    }

    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, updateSchedule])

  const toggleDay = (day: keyof WeekSchedule) => {
    updateSchedule(day, (prev) => ({
      ...prev,
      enabled: !prev.enabled,
    }))
  }

  // Set initial scroll position to 8 AM
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        8 * PIXELS_PER_HOUR + WEEK_TABLE_HEADER_HEIGHT - 7
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Weekly Availability</h3>
        <p className="text-xs text-muted-foreground">
          Click day names to enable/disable • Drag block edges to adjust times
        </p>
      </div>

      <Card className="p-4">
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-scroll"
          style={{ height: `${SCHEDULE_VIEWPORT_HEIGHT}px` }}
        >
          {/* Time labels */}
          <div
            className="flex flex-col justify-items-start py-0 pt-11"
            style={{ height: TOTAL_HEIGHT + 64 }}
          >
            {HOURS /* .filter((h) => h % 2 === 0) */.map((hour) => (
              <div
                key={hour}
                className="text-xs text-muted-foreground p-0 m-0 relative"
                style={{ height: PIXELS_PER_HOUR }}
              >
                <span className="relative -top-2">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div ref={containerRef} className="flex-1 grid grid-cols-7 gap-2">
            {DAYS.map(({ key, label }) => {
              const daySchedule = schedule[key]
              const isEnabled = daySchedule.enabled

              return (
                <div key={key} className="flex flex-col">
                  {/* Day header */}
                  <button
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={`px-2 rounded-t-lg text-sm font-semibold transition-colors ${
                      isEnabled
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    style={{ height: WEEK_TABLE_HEADER_HEIGHT }}
                  >
                    {label}
                  </button>

                  {/* Time grid */}
                  <div
                    className={`relative border-x border-b rounded-b-lg ${
                      isEnabled ? 'bg-background' : 'bg-muted/30'
                    }`}
                    style={{ height: TOTAL_HEIGHT }}
                  >
                    {/* Hour lines */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute w-full border-t border-border/30"
                        style={{ top: hour * PIXELS_PER_HOUR }}
                      />
                    ))}

                    {/* Time blocks */}
                    {isEnabled &&
                      daySchedule.blocks.map((block) => {
                        const top = (block.start / 1440) * TOTAL_HEIGHT
                        const height =
                          ((block.end - block.start) / 1440) * TOTAL_HEIGHT

                        // Style based on block type
                        const isTentative = block.type === 'tentative'
                        const blockClasses = isTentative
                          ? 'absolute flex flex-col justify-between inset-x-0 mx-1 bg-blue-400/20 border-2 border-blue-400 border-dashed rounded-lg group hover:bg-blue-400/30 transition-colors'
                          : 'absolute flex flex-col justify-between inset-x-0 mx-1 bg-primary/20 border-2 border-primary rounded-lg group hover:bg-primary/30 transition-colors'

                        const handleClasses = isTentative
                          ? 'h-2 cursor-ns-resize hover:bg-blue-400/40 flex items-center justify-center border-0 bg-transparent p-0'
                          : 'h-2 cursor-ns-resize hover:bg-primary/40 flex items-center justify-center border-0 bg-transparent p-0'

                        const handleBarClasses = isTentative
                          ? 'w-8 h-0.5 bg-blue-600 rounded opacity-0 group-hover:opacity-100'
                          : 'w-8 h-0.5 bg-primary rounded opacity-0 group-hover:opacity-100'

                        return (
                          <div
                            key={block.id}
                            className={blockClasses}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                            }}
                          >
                            {/* Top resize handle */}
                            <button
                              type="button"
                              className={handleClasses}
                              onMouseDown={(e) =>
                                handleMouseDown(e, key, block.id, 'top')
                              }
                            >
                              <div className={handleBarClasses} />
                            </button>

                            {/* Content */}
                            <div className="flex-grow flex flex-row items-center justify-center px-1">
                              <span className="w-5" />
                              <span className="text-xs font-medium text-center">
                                {minutesToTime(block.start)}
                              </span>
                              <span className="text-xs font-medium text-center mx-1">
                                {minutesToTime(block.end)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeBlock(key, block.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 ml-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Bottom resize handle */}
                            <button
                              type="button"
                              className={handleClasses}
                              onMouseDown={(e) =>
                                handleMouseDown(e, key, block.id, 'bottom')
                              }
                            >
                              <div className={handleBarClasses} />
                            </button>
                          </div>
                        )
                      })}
                  </div>

                  {/* Add block buttons */}
                  {isEnabled && (
                    <div className="mt-2 space-y-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addBlock(key, 'regular')}
                        className="w-full"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Regular
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addBlock(key, 'tentative')}
                        className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Tentative
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Time blocks snap to 15-minute intervals. Multiple blocks per day are
          supported.
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary/20 border-2 border-primary rounded" />
            <span>Regular availability (guaranteed)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-400/20 border-2 border-blue-400 border-dashed rounded" />
            <span>Tentative availability (potential, not guaranteed)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
