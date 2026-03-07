import React, { createContext, useContext, useState, ReactNode } from 'react';
import { mockUsers as initialUsers, mockStudents as initialStudents, mockInterventions as initialInterventions, mockAppointments as initialAppointments } from './mockData';
import { User, Student, Intervention, Appointment } from './types';

interface DataContextType {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  interventions: Intervention[];
  setInterventions: React.Dispatch<React.SetStateAction<Intervention[]>>;
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  addUser: (user: User) => void;
  updateUser: (id: string, updatedUser: Partial<User>) => void;
  deleteUser: (id: string) => void;
  addStudent: (student: Student) => void;
  updateStudent: (id: string, updatedStudent: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  addIntervention: (intervention: Intervention) => void;
  updateIntervention: (id: string, updatedIntervention: Partial<Intervention>) => void;
  deleteIntervention: (id: string) => void;
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (id: string, updatedAppointment: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [interventions, setInterventions] = useState<Intervention[]>(initialInterventions);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);

  const addUser = (user: User) => {
    setUsers((prev) => [...prev, user]);
    
    // If the user is a student or faculty, also add/update them in the students list
    if (user.role === 'student') {
      const studentExists = students.find((s) => s.id === user.id);
      if (!studentExists) {
        // Create a basic student record
        const newStudent: Student = {
          id: user.id,
          name: user.name,
          email: user.email,
          program: 'Undeclared',
          year: 1,
          gpa: 0.0,
          riskLevel: 'low',
          riskScore: 0,
        };
        setStudents((prev) => [...prev, newStudent]);
      }
    }
  };

  const updateUser = (id: string, updatedUser: Partial<User>) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, ...updatedUser } : user))
    );
    
    // Update student record if it's a student
    const user = users.find((u) => u.id === id);
    if (user?.role === 'student' || updatedUser.role === 'student') {
      setStudents((prev) =>
        prev.map((student) =>
          student.id === id
            ? { ...student, name: updatedUser.name || student.name, email: updatedUser.email || student.email }
            : student
        )
      );
    }
  };

  const deleteUser = (id: string) => {
    setUsers((prev) => prev.filter((user) => user.id !== id));
    
    // Also remove from students if applicable
    setStudents((prev) => prev.filter((student) => student.id !== id));
  };

  const addStudent = (student: Student) => {
    setStudents((prev) => [...prev, student]);
  };

  const updateStudent = (id: string, updatedStudent: Partial<Student>) => {
    setStudents((prev) =>
      prev.map((student) => (student.id === id ? { ...student, ...updatedStudent } : student))
    );
    
    // Also update the corresponding user record if the student is a user
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id && user.role === 'student'
          ? { ...user, name: updatedStudent.name || user.name, email: updatedStudent.email || user.email }
          : user
      )
    );
  };

  const deleteStudent = (id: string) => {
    setStudents((prev) => prev.filter((student) => student.id !== id));
  };

  const addIntervention = (intervention: Intervention) => {
    setInterventions((prev) => [...prev, intervention]);
  };

  const updateIntervention = (id: string, updatedIntervention: Partial<Intervention>) => {
    setInterventions((prev) =>
      prev.map((intervention) => (intervention.id === id ? { ...intervention, ...updatedIntervention } : intervention))
    );
  };

  const deleteIntervention = (id: string) => {
    setInterventions((prev) => prev.filter((intervention) => intervention.id !== id));
  };

  const addAppointment = (appointment: Appointment) => {
    setAppointments((prev) => [...prev, appointment]);
  };

  const updateAppointment = (id: string, updatedAppointment: Partial<Appointment>) => {
    setAppointments((prev) =>
      prev.map((appointment) => (appointment.id === id ? { ...appointment, ...updatedAppointment } : appointment))
    );
  };

  const deleteAppointment = (id: string) => {
    setAppointments((prev) => prev.filter((appointment) => appointment.id !== id));
  };

  return (
    <DataContext.Provider
      value={{
        users,
        setUsers,
        students,
        setStudents,
        interventions,
        setInterventions,
        appointments,
        setAppointments,
        addUser,
        updateUser,
        deleteUser,
        addStudent,
        updateStudent,
        deleteStudent,
        addIntervention,
        updateIntervention,
        deleteIntervention,
        addAppointment,
        updateAppointment,
        deleteAppointment,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}