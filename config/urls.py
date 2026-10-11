"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from academics.views import (ClassRoomViewSet, EnrollmentViewSet, ParentViewSet,
                             StudentViewSet, SubjectViewSet, TeacherViewSet,
                             TeachingAssignmentViewSet)
from attendance.views import AttendanceViewSet
from communication.views import AnnouncementViewSet, NotificationViewSet
from core.views import (ActivityLogViewSet, ChangePasswordView, DashboardView,
                        LoginView, MeView, UserViewSet)
from finance.views import ExpenseViewSet, FeeViewSet, PaymentViewSet
from grades.views import GradeViewSet, PeriodViewSet, ReportCardViewSet
from schools.views import SchoolViewSet, SchoolYearViewSet

router = DefaultRouter()
router.register("users", UserViewSet)
router.register("activity-logs", ActivityLogViewSet)
router.register("schools", SchoolViewSet)
router.register("school-years", SchoolYearViewSet)
router.register("students", StudentViewSet)
router.register("parents", ParentViewSet)
router.register("teachers", TeacherViewSet)
router.register("classrooms", ClassRoomViewSet)
router.register("subjects", SubjectViewSet)
router.register("enrollments", EnrollmentViewSet)
router.register("teaching-assignments", TeachingAssignmentViewSet)
router.register("periods", PeriodViewSet)
router.register("grades", GradeViewSet)
router.register("report-cards", ReportCardViewSet)
router.register("attendance", AttendanceViewSet)
router.register("fees", FeeViewSet)
router.register("payments", PaymentViewSet)
router.register("expenses", ExpenseViewSet)
router.register("announcements", AnnouncementViewSet)
router.register("notifications", NotificationViewSet)


def spa(request, *args, **kwargs):
    """Renvoie l'application React (index.html) pour toutes les pages du front."""
    index = settings.FRONT_DIST / "index.html"
    if not index.exists():
        return HttpResponse(
            "Front-end non construit. Lancez run_qa.bat, ou « npm run dev » en développement.",
            status=503, content_type="text/plain; charset=utf-8")
    response = HttpResponse(index.read_text(encoding="utf-8"),
                            content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    return response


urlpatterns = [
    path("api/token/", LoginView.as_view(), name="token"),
    path("api/token/refresh/", TokenRefreshView.as_view()),
    path("api/me/", MeView.as_view(), name="me"),
    path("api/me/password/", ChangePasswordView.as_view(), name="change_password"),
    path("api/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("api/", include(router.urls)),
    # Photos : servies par Django (suffisant pour le dev et la QA ; en production,
    # prévoir un stockage d'objets de type S3)
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]

if settings.ADMIN_ENABLED:
    urlpatterns.insert(0, path("admin/", admin.site.urls))

# Doit rester en dernier : toutes les autres URLs vont vers le front React
urlpatterns.append(re_path(r"^(?!api/|admin/|media/|static/|assets/).*$", spa))