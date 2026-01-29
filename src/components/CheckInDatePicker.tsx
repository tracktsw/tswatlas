import { useState } from 'react';
import { format, isToday, isFuture, startOfDay } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CheckInDatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  hasExistingData?: boolean;
}

export function CheckInDatePicker({ 
  selectedDate, 
  onDateChange,
  hasExistingData = false
}: CheckInDatePickerProps) {
  const [open, setOpen] = useState(false);
  const isTodaySelected = isToday(selectedDate);

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    // Don't allow future dates
    if (!isFuture(newDate)) {
      onDateChange(newDate);
    }
  };

  const handleSelectDate = (date: Date | undefined) => {
    if (date && !isFuture(date)) {
      onDateChange(startOfDay(date));
      setOpen(false);
    }
  };

  const canGoNext = !isTodaySelected;

  return (
    <div className="glass-card-warm p-3 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        {/* Previous day button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreviousDay}
          className="h-9 w-9 rounded-xl"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Date picker trigger */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex-1 h-10 justify-center gap-2 font-medium rounded-xl",
                !isTodaySelected && "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              <span>
                {isTodaySelected 
                  ? `Today · ${format(selectedDate, 'EEE d MMM')}`
                  : format(selectedDate, 'EEE d MMM yyyy')
                }
              </span>
              {hasExistingData && (
                <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  has data
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectDate}
              disabled={(date) => isFuture(date)}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Next day button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextDay}
          disabled={!canGoNext}
          className="h-9 w-9 rounded-xl"
        >
          <ChevronRight className={cn("h-5 w-5", !canGoNext && "opacity-30")} />
        </Button>
      </div>

      {/* Backfill mode indicator */}
      {!isTodaySelected && (
        <div className="mt-2 px-2 py-1.5 bg-amber-500/10 rounded-lg text-center">
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
            📅 You're logging data for {format(selectedDate, 'EEEE, d MMMM')}
          </p>
        </div>
      )}
    </div>
  );
}
