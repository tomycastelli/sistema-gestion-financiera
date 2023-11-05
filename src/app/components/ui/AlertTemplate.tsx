"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
import { Button } from "./button";

type ButtonVariant =
  | "outline"
  | "link"
  | "success"
  | "default"
  | "destructive"
  | "secondary"
  | "ghost"
  | null
  | undefined;

interface AlertTemplateProps {
  buttonStyling?: string;
  buttonVariant?: ButtonVariant;
  buttonText: string;
  alertTitle: string;
  alertDescription?: string;
  alertCancel: string;
  alertAccept: string;
  alertFunction: () => void;
  isLoading?: boolean;
  isSuccess?: boolean;
  successText?: string;
}

const AlertTemplate = ({
  buttonText,
  buttonStyling,
  buttonVariant,
  alertTitle,
  alertDescription,
  alertCancel,
  alertAccept,
  alertFunction,
  isLoading,
}: AlertTemplateProps) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={buttonVariant} className={buttonStyling}>
          {isLoading ? "Cargando..." : buttonText}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
          <AlertDialogDescription>{alertDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{alertCancel}</AlertDialogCancel>
          <AlertDialogAction onClick={() => alertFunction()}>
            {alertAccept}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AlertTemplate;
