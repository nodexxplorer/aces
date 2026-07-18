package api

import (
	"net/http"
	"strings"

	db "github.com/aces/backend/internal/db/sql"
	"github.com/aces/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type createUserRequest struct {
	Email          string  `json:"email" binding:"required,email"`
	Password       string  `json:"password" binding:"required,min=6,max=72"`
	Role           string  `json:"role" binding:"required,oneof=hod admin lecturer class_rep student bursar_dept bursar_class"`
	FullName       string  `json:"full_name" binding:"required,min=2,max=255"`
	Phone          *string `json:"phone" binding:"omitempty,max=20"`
	AvatarUrl      *string `json:"avatar_url" binding:"omitempty,url"`
	CreatedByHodID string  `json:"created_by_hod_id" binding:"omitempty,uuid"`
}

func (server *Server) createUser(ctx *gin.Context) {
	var req createUserRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Only HOD can set created_by_hod_id
	if req.CreatedByHodID != "" {
		hodID, err := uuid.Parse(req.CreatedByHodID)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid created_by_hod_id, must be a valid UUID"})
			return
		}
		_ = pgtype.UUID{Bytes: hodID, Valid: true}
	}

	user, err := server.users.Create(ctx, service.CreateUserInput{
		Email:     req.Email,
		Password:  req.Password,
		Role:      req.Role,
		FullName:  req.FullName,
		Phone:     req.Phone,
		AvatarURL: req.AvatarUrl,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"data": toUserResponse(user, false)})
}

func (server *Server) getUser(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	user, err := server.users.GetByID(ctx, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	resp := toUserResponse(user, false)

	// If user is a student, fetch student-specific data
	if string(user.Role) == "student" {
		queries, ok := server.store.(*db.Queries)
		if ok {
			student, studentErr := queries.GetStudentByUserIDFull(ctx, id)
			if studentErr == nil {
				resp.MatricNumber = &student.MatricNumber
				level := int(student.Level)
				resp.Level = &level
				resp.EntryYear = &student.EntryYear
				resp.AdmissionMode = student.AdmissionMode
				resp.YearAdmitted = student.YearAdmitted
				if student.Cgpa.Valid {
					cgpa := student.Cgpa.Int.Int64()
					resp.CGPA = &cgpa
				}
				standing := string(*student.AcademicStanding)
				resp.AcademicStanding = &standing
				resp.OnboardingCompleted = student.OnboardingCompleted
			}

			// Fetch extra profile fields
			extra, extraErr := queries.GetUserExtraFields(ctx, id)
			if extraErr == nil {
				resp.DateOfBirth = extra.DateOfBirth
				resp.EmergencyContactName = extra.EmergencyContactName
				resp.EmergencyContactPhone = extra.EmergencyContactPhone
				resp.HomeAddress = extra.HomeAddress
			}
		}
	} else {
		// Non-students can also have extra fields
		queries, ok := server.store.(*db.Queries)
		if ok {
			extra, extraErr := queries.GetUserExtraFields(ctx, id)
			if extraErr == nil {
				resp.DateOfBirth = extra.DateOfBirth
				resp.EmergencyContactName = extra.EmergencyContactName
				resp.EmergencyContactPhone = extra.EmergencyContactPhone
				resp.HomeAddress = extra.HomeAddress
			}
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": resp})
}

type listUsersRequest struct {
	PageID   int32  `form:"page_id" binding:"required,min=1"`
	PageSize int32  `form:"page_size" binding:"required,min=5,max=500"`
	Role     string `form:"role"`
	Search   string `form:"search"`
}

func (server *Server) listUsers(ctx *gin.Context) {
	var req listUsersRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	offset := (req.PageID - 1) * req.PageSize

	users, err := server.users.ListUsersWithStudents(ctx, req.PageSize, offset, req.Role, req.Search)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	resp := make([]userResponse, 0, len(users))
	for _, u := range users {
		role := string(u.Role)
		if role == "admin" {
			role = "delegated_admin"
		} else if role == "bursar_dept" {
			role = "dept_bursar"
		} else if role == "bursar_class" {
			role = "class_bursar"
		}

		createdAt := ""
		if u.CreatedAt != nil {
			createdAt = *u.CreatedAt
		}

		ur := userResponse{
			ID:             u.ID.String(),
			Email:          u.Email,
			FullName:       u.FullName,
			Phone:          u.Phone,
			Avatar:         u.AvatarUrl,
			Roles:          []string{role},
			ActiveRole:     role,
			Role:           role,
			IsApproved:     u.IsApproved,
			IsActive:       u.IsActive,
			ApprovalStatus: "pending",
			CreatedAt:      createdAt,
			MatricNumber:   u.MatricNumber,
			Level:          intPtrFromInt32(u.Level),
			AllRoles:       strings.Split(u.AllRoles, ","),
		}
		if u.IsApproved {
			ur.ApprovalStatus = "approved"
		}

		parts := strings.SplitN(u.FullName, " ", 2)
		ur.FirstName = parts[0]
		if len(parts) > 1 {
			ur.LastName = parts[1]
		}

		resp = append(resp, ur)
	}

	ctx.JSON(http.StatusOK, gin.H{"data": resp})
}

func intPtrFromInt32(p *int32) *int {
	if p == nil {
		return nil
	}
	v := int(*p)
	return &v
}

type updateUserRequest struct {
	FullName       *string `json:"full_name"`
	FullNameCamel  *string `json:"fullName"`
	Phone          *string `json:"phone"`
	AvatarUrl      *string `json:"avatar_url"`
	AvatarUrlCamel *string `json:"avatarUrl"`
	IsActive       *bool   `json:"is_active"`
	IsActiveCamel  *bool   `json:"isActive"`
	Email          *string `json:"email"`
	Role           *string `json:"role"`
	// Student-specific fields
	DateOfBirth          *string `json:"dateOfBirth"`
	DateOfBirthSnake     *string `json:"date_of_birth"`
	MatricNumber         *string `json:"matricNumber"`
	MatricNumberSnake    *string `json:"matric_number"`
	Level                *string `json:"level"`
	AdmissionMode        *string `json:"admissionMode"`
	AdmissionModeSnake   *string `json:"admission_mode"`
	YearAdmitted         *string `json:"yearAdmitted"`
	YearAdmittedSnake    *string `json:"year_admitted"`
	// Extra profile fields
	EmergencyContactName      *string `json:"emergencyContactName"`
	EmergencyContactNameSnake *string `json:"emergency_contact_name"`
	EmergencyContactPhone      *string `json:"emergencyContactPhone"`
	EmergencyContactPhoneSnake *string `json:"emergency_contact_phone"`
	HomeAddress               *string `json:"homeAddress"`
	HomeAddressSnake          *string `json:"home_address"`
}

func (server *Server) updateUser(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var req updateUserRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var fullName *string
	if req.FullName != nil {
		fullName = req.FullName
	} else if req.FullNameCamel != nil {
		fullName = req.FullNameCamel
	}

	var avatarUrl *string
	if req.AvatarUrl != nil {
		avatarUrl = req.AvatarUrl
	} else if req.AvatarUrlCamel != nil {
		avatarUrl = req.AvatarUrlCamel
	}

	var isActive *bool
	if req.IsActive != nil {
		isActive = req.IsActive
	} else if req.IsActiveCamel != nil {
		isActive = req.IsActiveCamel
	}

	input := service.UpdateUserPartialInput{
		FullName:  fullName,
		Phone:     req.Phone,
		AvatarURL: avatarUrl,
		IsActive:  isActive,
	}

	if req.Email != nil {
		input.Email = req.Email
	}
	if req.Role != nil {
		input.Role = req.Role
	}

	user, err := server.users.UpdatePartial(ctx, id, input)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	queries, ok := server.store.(*db.Queries)
	if ok {
		// Update extra profile fields (date_of_birth, emergency_contact, home_address)
		dob := req.DateOfBirth
		if dob == nil {
			dob = req.DateOfBirthSnake
		}
		emergencyName := req.EmergencyContactName
		if emergencyName == nil {
			emergencyName = req.EmergencyContactNameSnake
		}
		emergencyPhone := req.EmergencyContactPhone
		if emergencyPhone == nil {
			emergencyPhone = req.EmergencyContactPhoneSnake
		}
		homeAddr := req.HomeAddress
		if homeAddr == nil {
			homeAddr = req.HomeAddressSnake
		}
		if dob != nil || emergencyName != nil || emergencyPhone != nil || homeAddr != nil {
			_ = queries.UpdateUserExtraFields(ctx, id, dob, emergencyName, emergencyPhone, homeAddr)
		}

		// Update student-specific fields if user is a student
		matric := req.MatricNumber
		if matric == nil {
			matric = req.MatricNumberSnake
		}
		level := req.Level
		admMode := req.AdmissionMode
		if admMode == nil {
			admMode = req.AdmissionModeSnake
		}
		yearAdm := req.YearAdmitted
		if yearAdm == nil {
			yearAdm = req.YearAdmittedSnake
		}
		if matric != nil || level != nil || admMode != nil || yearAdm != nil {
			_ = queries.UpdateStudentFieldsByAdmin(ctx, id, matric, level, admMode, yearAdm)
		}
	}

	// Build enhanced response
	resp := toUserResponse(user, false)

	// Re-fetch student and extra data for the response
	if ok {
		if string(user.Role) == "student" {
			student, studentErr := queries.GetStudentByUserIDFull(ctx, id)
			if studentErr == nil {
				resp.MatricNumber = &student.MatricNumber
				level := int(student.Level)
				resp.Level = &level
				resp.EntryYear = &student.EntryYear
				resp.AdmissionMode = student.AdmissionMode
				resp.YearAdmitted = student.YearAdmitted
			if student.Cgpa.Valid {
				cgpa := student.Cgpa.Int.Int64()
				resp.CGPA = &cgpa
			}
			standing := string(*student.AcademicStanding)
			resp.AcademicStanding = &standing
		}
		}
		extra, extraErr := queries.GetUserExtraFields(ctx, id)
		if extraErr == nil {
			resp.DateOfBirth = extra.DateOfBirth
			resp.EmergencyContactName = extra.EmergencyContactName
			resp.EmergencyContactPhone = extra.EmergencyContactPhone
			resp.HomeAddress = extra.HomeAddress
		}
	}

	ctx.JSON(http.StatusOK, gin.H{"data": resp})
}

func (server *Server) deleteUser(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// Use hard delete with cascade
	queries, ok := server.store.(*db.Queries)
	if ok {
		err = queries.DeleteUserHard(ctx, id)
	} else {
		err = server.users.Delete(ctx, id)
	}
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "user deleted"})
}
