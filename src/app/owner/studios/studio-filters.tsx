"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StudioFiltersProps {
  search: string;
  statusFilter: string;
  healthFilter: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onHealthFilterChange: (value: string) => void;
}

export function StudioFilters({
  search,
  statusFilter,
  healthFilter,
  onSearchChange,
  onStatusFilterChange,
  onHealthFilterChange,
}: StudioFiltersProps) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name, domain, or notes..."
          className="pl-9"
          aria-label="Search studios"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by studio status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
        </SelectContent>
      </Select>
      <Select value={healthFilter} onValueChange={onHealthFilterChange}>
        <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by database health">
          <SelectValue placeholder="Database" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All databases</SelectItem>
          <SelectItem value="healthy">Connected</SelectItem>
          <SelectItem value="unhealthy">Unreachable</SelectItem>
          <SelectItem value="checking">Checking</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
