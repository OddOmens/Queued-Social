import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Post } from '@/types/data';
import { cn } from '@/lib/utils';

interface MonthlyCalendarProps {
    posts: Post[];
    onDayClick: (date: Date) => void;
    selectedDate: Date | null;
}

export function MonthlyCalendar({ posts, onDayClick, selectedDate }: MonthlyCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days: (Date | null)[] = [];

        // Add empty slots for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add all days in the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }

        return days;
    };

    const getPostsForDay = (date: Date): Post[] => {
        return posts.filter(post => {
            const postDate = post.scheduledTime || post.publishedAt || post.createdAt;
            if (!postDate) return false;
            const d = new Date(postDate);
            return (
                d.getDate() === date.getDate() &&
                d.getMonth() === date.getMonth() &&
                d.getFullYear() === date.getFullYear()
            );
        });
    };

    const previousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const goToToday = () => {
        setCurrentMonth(new Date());
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    const isSelected = (date: Date) => {
        if (!selectedDate) return false;
        return (
            date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear()
        );
    };

    const days = getDaysInMonth(currentMonth);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
        <Card className="p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{monthName}</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToToday}>
                        Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={previousMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Week Days Header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
                {weekDays.map(day => (
                    <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
                {days.map((date, index) => {
                    if (!date) {
                        return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const postsOnDay = getPostsForDay(date);
                    const postCount = postsOnDay.length;
                    const isTodayDate = isToday(date);
                    const isSelectedDate = isSelected(date);

                    return (
                        <button
                            key={index}
                            onClick={() => onDayClick(date)}
                            className={cn(
                                "aspect-square p-2 rounded-lg border-2 transition-all hover:border-primary hover:bg-accent/50 flex flex-col items-center justify-start relative",
                                isTodayDate && "border-primary bg-primary/10",
                                isSelectedDate && "border-primary bg-primary/20",
                                !isTodayDate && !isSelectedDate && "border-border"
                            )}
                        >
                            <span className={cn(
                                "text-sm font-medium mb-1",
                                isTodayDate && "text-primary font-bold"
                            )}>
                                {date.getDate()}
                            </span>
                            {postCount > 0 && (
                                <div className="flex items-center justify-center w-full mt-auto">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                                        {postCount}
                                    </span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}
