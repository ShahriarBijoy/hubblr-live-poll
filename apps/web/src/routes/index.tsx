import { createFileRoute } from "@tanstack/react-router";
import { CreatePollView } from "../slices/create-poll/create-poll.view";

export const Route = createFileRoute("/")({ component: CreatePollView });
