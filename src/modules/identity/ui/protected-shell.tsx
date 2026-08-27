"use client";

import type { ReactNode } from "react";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  getRoleNavigation,
  ROLE_LABELS,
} from "@/modules/navigation/role-navigation";
import type { Role } from "@/modules/identity/domain/roles";
import { SignOutButton } from "./sign-out-button";

import styles from "./protected-shell.module.css";

export type ProtectedShellProps = {
  role: Role;
  currentPath?: string;
  children: ReactNode;
};

function isCurrentPath(href: string, currentPath: string): boolean {
  if (href === "/app") return currentPath === "/app";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function ProtectedShell({ role, currentPath, children }: ProtectedShellProps) {
  const navigation = getRoleNavigation(role);
  const detectedPath = usePathname();
  const activePath = currentPath ?? detectedPath;

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <Link className={styles.brand} href="/app" aria-label="PalmTrack">
            PalmTrack
          </Link>
          <span className={styles.context}>พื้นที่ทำงานหลัก</span>
        </div>
        <div className={styles.userSection}>
          <div className={styles.role}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>{ROLE_LABELS[role]}</span>
          </div>
          <SignOutButton />
        </div>
      </header>
      <div className={styles.body}>
        <nav className={styles.navigation} aria-label="เมนูหลัก">
          <p className={styles.navigationLabel}>ไปยัง</p>
          <ul>
            {navigation.map(({ label, href, icon: Icon }) => {
              const current = isCurrentPath(href, activePath);
              return (
                <li key={href}>
                  <Link
                    className={styles.navigationLink}
                    href={href}
                    aria-current={current ? "page" : undefined}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                    <ArrowRight className={styles.arrow} size={16} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className={styles.main} id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
