package api

import (
	"fmt"
	"log"
	"net/http"

	"github.com/aces/backend/internal/tenant"
	"github.com/gin-gonic/gin"
)

// departmentMatricProblem decides whether matric may be used in the department
// bound to the request. It returns 0 when it may. Otherwise it returns the HTTP
// status and the message to show the student.
//
// The matric number must match the department the student is signing in to.
// A matric number that belongs to another department is refused, and the
// message names that department.
func (server *Server) departmentMatricProblem(ctx *gin.Context, matric string) (int, string) {
	current, ok := tenant.From(ctx.Request.Context())
	if !ok {
		// Handlers behind the tenant middleware always have a department bound.
		// Failing here means a routing bug, so fail closed.
		log.Printf("[matric] no department bound to %s", ctx.Request.URL.Path)
		return http.StatusInternalServerError, "internal server error"
	}
	if tenant.MatricNumberMatches(current.MatricCode, matric) {
		return 0, ""
	}

	// Only a mismatch needs the other departments, to name the one the matric
	// number belongs to. A department with no code cannot be matched against,
	// so skip the lookup in that case.
	var active []tenant.Tenant
	if current.MatricCode != "" {
		list, err := server.tenants.Active(ctx.Request.Context())
		if err != nil {
			log.Printf("[matric] list departments: %v", err)
		} else {
			active = list
		}
	}
	return matricProblem(current, matric, active)
}

// matchingDepartment returns the active department, other than current, whose
// matric code the number carries.
func matchingDepartment(current tenant.Tenant, matric string, active []tenant.Tenant) (tenant.Tenant, bool) {
	for _, t := range active {
		if t.ID != current.ID && tenant.MatricNumberMatches(t.MatricCode, matric) {
			return t, true
		}
	}
	return tenant.Tenant{}, false
}

// matricOwner finds the other active department that the matric number belongs
// to. It reports false when no department claims the number, or when the
// department list cannot be read, so the refusal then has no department to name.
func (server *Server) matricOwner(ctx *gin.Context, matric string) (tenant.Tenant, bool) {
	current, ok := tenant.From(ctx.Request.Context())
	if !ok {
		return tenant.Tenant{}, false
	}
	list, err := server.tenants.Active(ctx.Request.Context())
	if err != nil {
		log.Printf("[matric] list departments: %v", err)
		return tenant.Tenant{}, false
	}
	return matchingDepartment(current, matric, list)
}

// matricRefusalBody is the error body for a refused matric number. When another
// department owns the number, it names that department by slug and name, so the
// client can send the student there. Otherwise it carries only the error.
func matricRefusalBody(msg string, owner tenant.Tenant, found bool) gin.H {
	body := gin.H{"error": msg}
	if found {
		body["department"] = gin.H{"slug": owner.Slug, "name": owner.Name}
	}
	return body
}

// matricProblem is the decision behind departmentMatricProblem, without the
// database. active lists the other active departments.
func matricProblem(current tenant.Tenant, matric string, active []tenant.Tenant) (int, string) {
	if current.MatricCode == "" {
		return http.StatusUnprocessableEntity, fmt.Sprintf(
			"Matric numbers are not set up for %s yet. Contact the department office.", current.Name)
	}
	if tenant.MatricNumberMatches(current.MatricCode, matric) {
		return 0, ""
	}
	if owner, ok := matchingDepartment(current, matric, active); ok {
		return http.StatusBadRequest, fmt.Sprintf(
			"This matric number belongs to %s. Choose that department to continue.", owner.Name)
	}
	return http.StatusBadRequest, fmt.Sprintf(
		"Matric numbers for %s look like %s.", current.Name, tenant.MatricExample(current.MatricCode))
}
