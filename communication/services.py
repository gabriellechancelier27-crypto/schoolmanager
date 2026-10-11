from .models import Notification


def notify_users(users, title, message, link=""):
    Notification.objects.bulk_create(
        [Notification(user=user, title=title, message=message, link=link) for user in users])


def notify_student(student, title, message, link=""):
    """Notifie l'élève (si compte) et ses parents/tuteurs (§4.19)."""
    recipients = [student.user] if student.user_id else []
    for row in student.student_parents.select_related("parent"):
        if row.parent.user_id:
            recipients.append(row.parent.user)
    if recipients:
        notify_users(recipients, title, message, link)