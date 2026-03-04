import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Clock, FolderOpen, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchCourses, createCourse, updateCourse, deleteCourse } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";

const Index = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [courseName, setCourseName] = useState("");
  const [open, setOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<{ courseId: string; courseName: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingCourse, setDeletingCourse] = useState<{ courseId: string; courseName: string } | null>(null);
  const queryClient = useQueryClient();

  // 搜索防抖 300ms，减少输入时的重复请求
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: courses = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["courses", debouncedSearch],
    queryFn: () => fetchCourses(debouncedSearch || undefined),
    retry: 1,
    retryDelay: 1500,
    staleTime: 60 * 1000,       // 1 分钟内用缓存，不重复请求
    gcTime: 5 * 60 * 1000,      // 缓存保留 5 分钟，返回页面秒开
  });

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setCourseName("");
      setOpen(false);
      toast.success("课程已创建");
    },
    onError: (e: Error) => toast.error(e.message || "创建失败"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ courseId, courseName: name }: { courseId: string; courseName: string }) =>
      updateCourse(courseId, { courseName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setEditingCourse(null);
      setEditName("");
      toast.success("已保存");
    },
    onError: (e: Error) => toast.error(e.message || "保存失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setDeletingCourse(null);
      toast.success("课程已删除");
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
  });

  const filtered = courses.filter((c) =>
    c.courseName.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    const name = courseName.trim();
    if (!name) {
      toast.error("请输入课程名称");
      return;
    }
    createMutation.mutate(name);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            我的课程
          </h1>
          <p className="mt-2 text-muted-foreground">
            上传 PPT，提炼知识点，持续追问，构建你的学习知识库
          </p>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索课程..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                新建课程
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建课程</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="课程名称"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? "创建中..." : "创建"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">加载中...</div>
        ) : isError ? (
          <div className="py-20 text-center space-y-3">
            <p className="text-muted-foreground">加载失败</p>
            <p className="text-sm text-muted-foreground/80">{error?.message || "请确认后端已启动 (npm run start)"}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>重试</Button>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course) => (
              <div
                key={course.courseId}
                className="group relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:shadow-lg hover:border-accent/50 hover:-translate-y-0.5"
              >
                <div
                  className="absolute right-2 top-2 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          setEditingCourse({ courseId: course.courseId, courseName: course.courseName });
                          setEditName(course.courseName);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        修改
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          setDeletingCourse({ courseId: course.courseId, courseName: course.courseName });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Link to={`/course/${course.courseId}`} className="block">
                  <div className="mb-4 flex items-start justify-between pr-8">
                    <span className="text-3xl">{course.emoji ?? "📁"}</span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {course.chapterCount != null ? `${course.chapterCount} 章` : "—"}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground group-hover:text-accent transition-colors">
                    {course.courseName}
                  </h3>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>最近打开 {course.lastOpenAt ?? "-"}</span>
                  </div>
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-accent transition-all duration-300 group-hover:w-full" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-surface-sunken py-20">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">暂无课程</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              点击"新建课程"开始你的学习之旅
            </p>
          </div>
        )}

        <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>修改课程</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="课程名称"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && editingCourse && editName.trim() && updateMutation.mutate({ courseId: editingCourse.courseId, courseName: editName.trim() })}
              />
              <Button
                onClick={() => editingCourse && editName.trim() && updateMutation.mutate({ courseId: editingCourse.courseId, courseName: editName.trim() })}
                disabled={!editName.trim() || updateMutation.isPending}
                className="w-full"
              >
                {updateMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletingCourse} onOpenChange={(open) => !open && setDeletingCourse(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除课程</AlertDialogTitle>
              <AlertDialogDescription>
                确定删除「{deletingCourse?.courseName}」？其下所有章节与文档将一并删除，且无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletingCourse && deleteMutation.mutate(deletingCourse.courseId)}
              >
                {deleteMutation.isPending ? "删除中..." : "删除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Index;
