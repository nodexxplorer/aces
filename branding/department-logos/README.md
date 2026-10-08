# Department logos

Put each department's logo in this folder. The file name says which department
the logo belongs to: the department's matric code, with the `/` written as `-`.

| File | Department | Matric code |
|------|------------|-------------|
| `EG-CE.png` | Chemical Engineering | EG/CE |
| `EG-EE.png` | Electrical Engineering | EG/EE |
| `EG-PE.png` | Petroleum Engineering | EG/PE |
| `EG-AE.png` | Agricultural Engineering | EG/AE |
| `EG-FE.png` | Food Engineering | EG/FE |
| `EG-CV.png` | Civil Engineering | EG/CV |
| `EG-ME.png` | Mechanical Engineering | EG/ME |
| `EG-CO.png` | Computer Engineering (`uniuyo-ce`, the ACES logo) | EG/CO |

The files for the seven other departments are **placeholders**: grey tiles that
show the code. Replace the image and keep the file name. The apply step skips a
file that is still a placeholder, so one you have not replaced is never published.

Images must be PNG, JPEG or WebP, at most 256 KiB.

## Apply the logos

Use the owner database connection, as for the other `cmd/tenant` commands. Check
first with `-dry-run`:

```sh
cd backend
DB_SOURCE='postgresql://<owner>@<host>/<db>?sslmode=require' go run ./cmd/tenant logos -dir ../branding/department-logos -dry-run
DB_SOURCE='postgresql://<owner>@<host>/<db>?sslmode=require' go run ./cmd/tenant logos -dir ../branding/department-logos
```

A department is found by its matric code, so it must have one
(`go run ./cmd/tenant update -slug <slug> -matric-code EG/EE`). A department
whose file is missing keeps its current logo. A department with no logo shows
the neutral badge, and its emails and PDFs show its name only.
